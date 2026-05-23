import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { storageKey, uploadFile } from "../lib/storage";
import { docxToPdf, convertedPdfKey } from "../lib/convert";
import fs from "node:fs/promises";
import path from "node:path";

export const hostFilesRouter = Router();

const ALLOWED_EXTENSIONS = new Set([
    "pdf",
    "docx",
    "doc",
    "txt",
    "md",
    "csv",
]);

const MIME_TYPES: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
};

function getHostFilesDir(): string | null {
    return process.env.HOST_FILES_DIR?.trim() || null;
}

function fileExt(filename: string): string {
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

type HostFileEntry = {
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
    ext?: string;
};

async function listDir(
    base: string,
    relDir: string,
): Promise<HostFileEntry[]> {
    const absDir = path.join(base, relDir);
    const real = await fs.realpath(absDir);
    if (!real.startsWith(await fs.realpath(base))) {
        throw new Error("Path traversal blocked");
    }

    const entries = await fs.readdir(absDir, { withFileTypes: true });
    const results: HostFileEntry[] = [];

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const relPath = path.join(relDir, entry.name);

        if (entry.isDirectory()) {
            results.push({
                name: entry.name,
                path: relPath,
                type: "directory",
            });
        } else if (entry.isFile()) {
            const ext = fileExt(entry.name);
            if (!ALLOWED_EXTENSIONS.has(ext)) continue;
            const stat = await fs.stat(path.join(absDir, entry.name));
            results.push({
                name: entry.name,
                path: relPath,
                type: "file",
                size: stat.size,
                ext,
            });
        }
    }

    results.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return results;
}

// GET /host-files
// Lists files in the configured HOST_FILES_DIR. Pass ?dir=subdir to browse.
hostFilesRouter.get("/", requireAuth, async (req, res) => {
    const base = getHostFilesDir();
    if (!base) {
        return void res
            .status(404)
            .json({ detail: "HOST_FILES_DIR is not configured" });
    }

    try {
        await fs.access(base);
    } catch {
        return void res
            .status(404)
            .json({ detail: "HOST_FILES_DIR does not exist" });
    }

    const relDir =
        typeof req.query.dir === "string"
            ? req.query.dir.replace(/\.\./g, "")
            : "";

    try {
        const entries = await listDir(base, relDir);
        res.json({ base_dir: base, dir: relDir, entries });
    } catch (err) {
        console.error("[host-files] list error:", err);
        res.status(500).json({ detail: "Failed to list directory" });
    }
});

// POST /host-files/import
// Reads a file from HOST_FILES_DIR, creates a document + version row, uploads to R2.
// Body: { path: "relative/path/to/file.pdf" }
hostFilesRouter.post("/import", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const base = getHostFilesDir();
    if (!base) {
        return void res
            .status(404)
            .json({ detail: "HOST_FILES_DIR is not configured" });
    }

    const relPath = req.body?.path;
    if (typeof relPath !== "string" || !relPath.trim()) {
        return void res.status(400).json({ detail: "path is required" });
    }

    const sanitized = relPath.replace(/\.\./g, "");
    const absPath = path.join(base, sanitized);

    try {
        const real = await fs.realpath(absPath);
        const realBase = await fs.realpath(base);
        if (!real.startsWith(realBase)) {
            return void res.status(400).json({ detail: "Invalid path" });
        }
    } catch {
        return void res.status(404).json({ detail: "File not found" });
    }

    const filename = path.basename(absPath);
    const ext = fileExt(filename);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return void res.status(400).json({
            detail: `Unsupported file type: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
        });
    }

    try {
        const content = await fs.readFile(absPath);
        const db = createServerSupabase();

        const { data: doc, error: insertErr } = await db
            .from("documents")
            .insert({
                project_id: null,
                user_id: userId,
                filename,
                file_type: ext,
                size_bytes: content.byteLength,
                status: "processing",
            })
            .select("*")
            .single();
        if (insertErr || !doc) {
            return void res
                .status(500)
                .json({ detail: "Failed to create document record" });
        }

        const docId = doc.id as string;
        const key = storageKey(userId, docId, filename);
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
        await uploadFile(
            key,
            content.buffer.slice(
                content.byteOffset,
                content.byteOffset + content.byteLength,
            ) as ArrayBuffer,
            contentType,
        );

        let pdfStoragePath: string | null = null;
        if (ext === "docx" || ext === "doc") {
            try {
                const pdfBuf = await docxToPdf(content);
                const pdfKey = convertedPdfKey(userId, docId);
                await uploadFile(
                    pdfKey,
                    pdfBuf.buffer.slice(
                        pdfBuf.byteOffset,
                        pdfBuf.byteOffset + pdfBuf.byteLength,
                    ) as ArrayBuffer,
                    "application/pdf",
                );
                pdfStoragePath = pdfKey;
            } catch (err) {
                console.error(
                    `[host-files/import] DOCX->PDF conversion failed for ${filename}:`,
                    err,
                );
            }
        } else if (ext === "pdf") {
            pdfStoragePath = key;
        }

        const { data: versionRow, error: verErr } = await db
            .from("document_versions")
            .insert({
                document_id: docId,
                storage_path: key,
                pdf_storage_path: pdfStoragePath,
                source: "upload",
                version_number: 1,
                display_name: filename,
            })
            .select("id")
            .single();
        if (verErr || !versionRow) {
            throw new Error(
                `Failed to record upload version: ${verErr?.message ?? "unknown"}`,
            );
        }

        await db
            .from("documents")
            .update({
                current_version_id: versionRow.id,
                status: "ready",
                updated_at: new Date().toISOString(),
            })
            .eq("id", docId);

        const { data: updated } = await db
            .from("documents")
            .select("*")
            .eq("id", docId)
            .single();

        res.status(201).json(updated);
    } catch (err) {
        console.error("[host-files/import] error:", err);
        res.status(500).json({
            detail: `Import failed: ${String(err)}`,
        });
    }
});
