"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Upload,
    Search,
    Loader2,
    HardDrive,
    FolderOpen,
    ChevronRight,
    Check,
    Folder,
} from "lucide-react";
import {
    uploadStandaloneDocument,
    uploadProjectDocument,
    addDocumentToProject,
    deleteDocument,
    listHostFiles,
    importHostFile,
} from "@/app/lib/mikeApi";
import type { HostFileEntry } from "@/app/lib/mikeApi";
import type { MikeDocument } from "./types";
import { FileDirectory, DocFileIcon } from "./FileDirectory";
import { useDirectoryData, invalidateDirectoryCache } from "./useDirectoryData";
import { OwnerOnlyModal } from "./OwnerOnlyModal";
import { useAuth } from "@/contexts/AuthContext";

export { invalidateDirectoryCache };

type Tab = "documents" | "host-files";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function HostFileBrowser({
    onImport,
}: {
    onImport: (doc: MikeDocument) => void;
}) {
    const [dirStack, setDirStack] = useState<string[]>([""]);
    const [entries, setEntries] = useState<HostFileEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState<Set<string>>(new Set());
    const [imported, setImported] = useState<Set<string>>(new Set());

    const currentDir = dirStack[dirStack.length - 1];

    const fetchDir = useCallback(async (dir: string) => {
        setLoading(true);
        try {
            const result = await listHostFiles(dir || undefined);
            setEntries(result.entries);
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDir(currentDir);
    }, [currentDir, fetchDir]);

    function navigateInto(dirPath: string) {
        setDirStack((prev) => [...prev, dirPath]);
    }

    function navigateBack() {
        if (dirStack.length > 1) {
            setDirStack((prev) => prev.slice(0, -1));
        }
    }

    async function handleImport(entry: HostFileEntry) {
        if (importing.has(entry.path) || imported.has(entry.path)) return;
        setImporting((prev) => new Set([...prev, entry.path]));
        try {
            const doc = await importHostFile(entry.path);
            invalidateDirectoryCache();
            setImported((prev) => new Set([...prev, entry.path]));
            onImport(doc);
        } catch (err) {
            console.error("Host file import failed:", err);
        } finally {
            setImporting((prev) => {
                const next = new Set(prev);
                next.delete(entry.path);
                return next;
            });
        }
    }

    const breadcrumbParts = currentDir ? currentDir.split("/") : [];

    return (
        <div className="rounded-sm border border-gray-100 overflow-hidden">
            {/* Navigation breadcrumb */}
            {dirStack.length > 1 && (
                <div className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 border-b border-gray-100">
                    <button
                        type="button"
                        onClick={() => setDirStack([""])}
                        className="hover:text-gray-600 transition-colors"
                    >
                        Host Files
                    </button>
                    {breadcrumbParts.map((part, i) => (
                        <span key={i} className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            <button
                                type="button"
                                onClick={() =>
                                    setDirStack(
                                        dirStack.slice(
                                            0,
                                            dirStack.indexOf(
                                                breadcrumbParts
                                                    .slice(0, i + 1)
                                                    .join("/"),
                                            ) + 1,
                                        ),
                                    )
                                }
                                className="hover:text-gray-600 transition-colors"
                            >
                                {part}
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={navigateBack}
                        className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                    >
                        Back
                    </button>
                </div>
            )}

            {loading ? (
                <div className="py-8 flex justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
            ) : entries.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                    No files found
                </p>
            ) : (
                entries.map((entry) => {
                    const isImporting = importing.has(entry.path);
                    const isImported = imported.has(entry.path);
                    return (
                        <button
                            type="button"
                            key={entry.path}
                            onClick={() =>
                                entry.type === "directory"
                                    ? navigateInto(entry.path)
                                    : handleImport(entry)
                            }
                            disabled={isImporting || isImported}
                            className={`w-full flex items-center gap-2 px-2 py-2 text-xs transition-colors text-left ${
                                isImported
                                    ? "bg-green-50"
                                    : "hover:bg-gray-50"
                            } disabled:opacity-60`}
                        >
                            {entry.type === "directory" ? (
                                <Folder className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            ) : (
                                <DocFileIcon fileType={entry.ext ?? null} />
                            )}
                            <span className="flex-1 truncate text-gray-700">
                                {entry.name}
                            </span>
                            {entry.type === "file" && entry.size != null && (
                                <span className="shrink-0 text-gray-300">
                                    {formatBytes(entry.size)}
                                </span>
                            )}
                            {entry.type === "directory" && (
                                <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                            )}
                            {isImporting && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />
                            )}
                            {isImported && (
                                <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            )}
                        </button>
                    );
                })
            )}
        </div>
    );
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (documents: MikeDocument[], projectId?: string) => void;
    breadcrumb: string[];
    allowMultiple?: boolean;
    projectId?: string;
}

export function AddDocumentsModal({
    open,
    onClose,
    onSelect,
    breadcrumb,
    allowMultiple = true,
    projectId,
}: Props) {
    const { loading, standaloneDocuments, projects } = useDirectoryData(open);
    const { user } = useAuth();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState("");
    const [extraUploadedDocs, setExtraUploadedDocs] = useState<MikeDocument[]>([]);
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [ownerOnlyAction, setOwnerOnlyAction] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<Tab>("documents");
    const [hostFilesAvailable, setHostFilesAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        if (!open) return;
        setSearch("");
        setSelectedIds(new Set());
        setExtraUploadedDocs([]);
        setDeletedIds(new Set());
        setActiveTab("documents");
        listHostFiles()
            .then(() => setHostFilesAvailable(true))
            .catch(() => setHostFilesAvailable(false));
    }, [open]);

    if (!open) return null;

    const q = search.toLowerCase().trim();

    const allStandalone = [
        ...extraUploadedDocs.filter(
            (u) => !standaloneDocuments.some((d) => d.id === u.id),
        ),
        ...standaloneDocuments,
    ].filter((d) => !deletedIds.has(d.id));

    const filteredStandalone = q
        ? allStandalone.filter((d) => d.filename.toLowerCase().includes(q))
        : allStandalone;

    const filteredProjects = projects
        .filter((p) => p.id !== projectId)
        .map((p) => ({
            ...p,
            documents: (p.documents || []).filter(
                (d) =>
                    !deletedIds.has(d.id) &&
                    (!q || d.filename.toLowerCase().includes(q)),
            ),
        }))
        .filter(
            (p) =>
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.documents.length > 0,
        );

    const allDocs = [
        ...allStandalone,
        ...projects.flatMap((p) => p.documents || []),
    ];

    async function handleConfirm() {
        const selected = allDocs.filter((d) => selectedIds.has(d.id));

        if (projectId) {
            const toAssign = selected.filter((d) => d.project_id !== projectId);
            const alreadyHere = selected.filter(
                (d) => d.project_id === projectId,
            );
            if (toAssign.length > 0) {
                setUploading(true);
                try {
                    const assigned = await Promise.all(
                        toAssign.map((d) =>
                            addDocumentToProject(projectId, d.id),
                        ),
                    );
                    onSelect([...alreadyHere, ...assigned], projectId);
                } catch (err) {
                    console.error("Failed to assign documents:", err);
                } finally {
                    setUploading(false);
                }
            } else {
                onSelect(alreadyHere, projectId);
            }
            onClose();
            return;
        }

        const projectIds = new Set(
            selected.map((d) => d.project_id).filter(Boolean),
        );
        const singleProjectId =
            projectIds.size === 1 ? [...projectIds][0]! : undefined;
        onSelect(selected, singleProjectId);
        onClose();
    }

    async function handleDelete(ids: string[]) {
        // Server only allows the doc creator to delete. Filter to owned
        // and warn for the rest.
        const docsById = new Map<string, MikeDocument>();
        for (const d of [
            ...standaloneDocuments,
            ...extraUploadedDocs,
            ...projects.flatMap((p) => p.documents ?? []),
        ]) {
            docsById.set(d.id, d);
        }
        const owned = ids.filter((id) => {
            const d = docsById.get(id);
            return !d || !d.user_id || !user?.id || d.user_id === user.id;
        });
        const blocked = ids.length - owned.length;
        if (owned.length === 0 && blocked > 0) {
            setOwnerOnlyAction(
                "delete these documents — only the document creator can delete a document",
            );
            return;
        }
        const idSet = new Set(owned);
        try {
            await Promise.all(owned.map((id) => deleteDocument(id)));
        } catch (err) {
            console.error("Delete failed:", err);
            return;
        }
        invalidateDirectoryCache();
        setExtraUploadedDocs((prev) => prev.filter((d) => !idSet.has(d.id)));
        setDeletedIds((prev) => {
            const next = new Set(prev);
            owned.forEach((id) => next.add(id));
            return next;
        });
        if (blocked > 0) {
            setOwnerOnlyAction(
                `delete ${blocked} of the selected documents — only the document creator can delete a document`,
            );
        }
    }

    function handleHostFileImported(doc: MikeDocument) {
        setExtraUploadedDocs((prev) => [doc, ...prev]);
        setSelectedIds((prev) => new Set([...prev, doc.id]));
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploading(true);
        try {
            const uploaded = await Promise.all(
                files.map((f) =>
                    projectId
                        ? uploadProjectDocument(projectId, f)
                        : uploadStandaloneDocument(f),
                ),
            );
            invalidateDirectoryCache();
            setExtraUploadedDocs((prev) => [...uploaded, ...prev]);
            uploaded.forEach((d) =>
                setSelectedIds((prev) => new Set([...prev, d.id])),
            );
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/10 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col h-[600px]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        {breadcrumb.map((segment, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                                {i > 0 && <span>›</span>}
                                {segment}
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tab bar — shown when host files are available */}
                {hostFilesAvailable && (
                    <div className="px-4 flex gap-1 border-b border-gray-100">
                        <button
                            type="button"
                            onClick={() => setActiveTab("documents")}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                                activeTab === "documents"
                                    ? "border-gray-900 text-gray-900"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Documents
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("host-files")}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                                activeTab === "host-files"
                                    ? "border-gray-900 text-gray-900"
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <HardDrive className="h-3.5 w-3.5" />
                            Host Files
                        </button>
                    </div>
                )}

                {/* Search bar — documents tab only */}
                {activeTab === "documents" && (
                    <div className="px-4 pt-1 pb-2">
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
                                autoFocus
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                    {activeTab === "documents" ? (
                        <FileDirectory
                            standaloneDocs={filteredStandalone}
                            directoryProjects={filteredProjects}
                            loading={loading}
                            selectedIds={selectedIds}
                            onChange={setSelectedIds}
                            allowMultiple={allowMultiple}
                            forceExpanded={!!q}
                            emptyMessage={
                                q ? "No matches found" : "No documents yet"
                            }
                            onDelete={handleDelete}
                        />
                    ) : (
                        <HostFileBrowser onImport={handleHostFileImported} />
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.doc,.txt,.md,.csv"
                            multiple
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            {uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Upload className="h-3.5 w-3.5" />
                            )}
                            {uploading ? "Uploading…" : "Upload"}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <span className="text-xs text-gray-400">
                                {selectedIds.size} selected
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0 || uploading}
                            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                        >
                            {uploading ? "Saving…" : "Confirm"}
                        </button>
                    </div>
                </div>
            </div>
            <OwnerOnlyModal
                open={!!ownerOnlyAction}
                action={ownerOnlyAction ?? undefined}
                onClose={() => setOwnerOnlyAction(null)}
            />
        </div>,
        document.body,
    );
}
