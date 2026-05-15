"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";
import { useSharedReportClient } from "@/lib/useSharedReportClient";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert } from "@mui/material";
import { ChevronDown, Trash2, Edit, X as LucideX } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PdfFileIcon } from "@/components/PdfFileIcon";

type SizeMapping = {
    client_size: string;
    standard_size: string;
};

type ReturnReportRow = {
    id: string | number;
    ry_number: string;
    shipped_date?: string;
    note?: string | null;
    shipping_round?: number | string | null;
    total_shipped?: number | string | null;
    total_received?: number | string | null;
    total_order?: number | string | null;
    accumulated_total?: number | string | null;
    lot_balance?: number | string | null;
    article?: string | null;
    model_name?: string | null;
    product?: string | null;
    CRD?: string | null;
    [key: string]: string | number | null | undefined;
};

type EditFormState = {
    date: string;
    note: string;
    sizeValues: Record<string, string>;
};

const blankEdit: EditFormState = {
    date: "",
    note: "",
    sizeValues: {},
};

const autocompletePopupIcon = <ChevronDown size={16} />;

function toInputDate(value?: string | null) {
    if (!value) return "";
    const parts = value.split("/");
    if (parts.length !== 3) return "";
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

async function loadRoboto(doc: jsPDF) {
    try {
        const res = await fetch("https://unpkg.com/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf");
        if (!res.ok) return;
        const blob = await res.blob();
        const base64Font = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
        doc.setFont("Roboto");
    } catch (error) {
        console.warn("Font error", error);
    }
}

export default function ReturnsDeliveryReportPage() {
    const [sharedClient, setSharedClient] = useSharedReportClient();
    const [client, setClient] = useState<string | undefined>(sharedClient || "");
    const [clients, setClients] = useState<string[]>([]);
    const [rows, setRows] = useState<ReturnReportRow[]>([]);
    const [orderRyFilter, setOrderRyFilter] = useState("");
    const [editRow, setEditRow] = useState<ReturnReportRow | null>(null);
    const [editForm, setEditForm] = useState(blankEdit);
    const [mappings, setMappings] = useState<SizeMapping[]>([]);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const isMounted = useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    useEffect(() => {
        const loadClients = async () => {
            try {
                const res = await axios.get("/api/returns/clients");
                const list = Array.isArray(res.data) ? (res.data as string[]) : [];
                setClients(list);
                if (!client && list.length > 0) {
                    setClient(list[0]);
                    setSharedClient(list[0]);
                }
            } catch (err) {
                console.error("[API] Load clients error:", err);
            }
        };
        void loadClients();
    }, [setSharedClient, client]);

    useEffect(() => {
        const loadMappings = async () => {
            if (!client) {
                setMappings([]);
                return;
            }
            try {
                const res = await axios.get(`/api/size-mappings?client=${encodeURIComponent(client)}`);
                setMappings(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("[API] Load mappings error:", err);
                setMappings([]);
            }
        };
        void loadMappings();
    }, [client]);

    const fetchRows = useCallback(async () => {
        if (!client) {
            setRows([]);
            return;
        }
        try {
            const res = await axios.get("/api/returns/shipped", { params: { client } });
            setRows(Array.isArray(res.data) ? (res.data as ReturnReportRow[]) : []);
        } catch (err) {
            console.error("[API] Fetch returns shipped error:", err);
            setRows([]);
        }
    }, [client]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchRows();
    }, [fetchRows]);

    const filteredRows = useMemo(() => {
        if (!orderRyFilter) return rows;
        const search = orderRyFilter.toLowerCase();
        return rows.filter(row =>
            (row.ry_number || "").toLowerCase().includes(search) ||
            (row.article || "").toLowerCase().includes(search) ||
            (row.model_name || "").toLowerCase().includes(search)
        );
    }, [rows, orderRyFilter]);

    const grouped = useMemo(() => {
        const map = new Map<string, ReturnReportRow[]>();
        filteredRows.forEach(row => {
            const date = String(row.shipped_date || "Không xác định");
            if (!map.has(date)) map.set(date, []);
            map.get(date)!.push(row);
        });
        return Array.from(map.entries()).map(([date, groupRows]) => ({ date, rows: groupRows }));
    }, [filteredRows]);

    const openEdit = (row: ReturnReportRow) => {
        const next: EditFormState = {
            date: toInputDate(row.shipped_date || ""),
            note: row.note || "",
            sizeValues: {},
        };
        entrySizes.forEach((size) => {
            next.sizeValues[String(size)] = String(row[sizeToCol(size)] ?? 0);
        });
        setEditRow(row);
        setEditForm(next);
    };

    const saveEdit = async () => {
        if (!editRow) return;
        const payload: Record<string, string | number | null> = {
            shipped_date: editForm.date || null,
            note: editForm.note.trim() || null,
        };
        let total = 0;
        entrySizes.forEach((size) => {
            const value = Number(editForm.sizeValues[String(size)]) || 0;
            payload[sizeToCol(size)] = value;
            total += value;
        });
        payload.total_shipped = total;

        try {
            await axios.put(`/api/returns/shipped?id=${editRow.id}&type=shipped`, payload);
            setSnackbar({ open: true, message: "Đã cập nhật thành công.", severity: "success" });
            setEditRow(null);
            await fetchRows();
        } catch (error) {
            console.error("[API] Update shipped return error:", error);
            setSnackbar({ open: true, message: "Cập nhật thất bại.", severity: "error" });
        }
    };

    const handleDelete = async (row: ReturnReportRow) => {
        if (!window.confirm(`Xóa báo cáo của ${row.ry_number}?`)) return;
        try {
            await axios.delete(`/api/returns/shipped?id=${row.id}&type=shipped`);
            setSnackbar({ open: true, message: "Đã xóa báo cáo.", severity: "success" });
            await fetchRows();
        } catch (err) {
            console.error("[API] Delete shipped return error:", err);
            setSnackbar({ open: true, message: "Xóa thất bại.", severity: "error" });
        }
    };

    const exportPDF = async () => {
        if (!client || grouped.length === 0) return;
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        await loadRoboto(doc);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let currentY = 40;

        doc.setFont("Roboto", "bold");
        doc.setFontSize(16);
        doc.text("BÁO BIỂU GIAO HÀNG TRẢ SỬA", 30, currentY);
        currentY += 20;
        doc.setFont("Roboto", "normal");
        doc.setFontSize(10);
        doc.text(`KHÁCH HÀNG: ${client.toUpperCase()}`, 30, currentY);
        doc.text(`NGÀY XUẤT: ${new Date().toLocaleDateString("vi-VN")}`, pageWidth - 30, currentY, { align: "right" });
        currentY += 30;

        for (let groupIndex = 0; groupIndex < grouped.length; groupIndex++) {
            const group = grouped[groupIndex];
            if (currentY > pageHeight - 100 && groupIndex > 0) {
                doc.addPage();
                currentY = 40;
            }

            doc.setFont("Roboto", "bold");
            doc.setFontSize(11);
            doc.setTextColor(59, 130, 246);
            doc.text(`NGÀY GIAO: ${group.date}`, 30, currentY);
            doc.setTextColor(0, 0, 0);
            currentY += 15;

            let activeSizes = entrySizes.filter(size =>
                group.rows.some(row => (Number(row[sizeToCol(size)]) || 0) > 0)
            );
            if (activeSizes.length === 0 && entrySizes.length > 0) activeSizes = [entrySizes[0]];

            const head = [[
                "STT", "ĐƠN HÀNG", "CRD", "ĐỢT", "MODEL NAME", "SL GIAO",
                "CÒN LẠI", "ĐƠN VỊ", "ART",
                ...activeSizes.map(size => {
                    const mapping = mappings.find(item => item.standard_size === String(size));
                    return mapping ? `${size} (${mapping.client_size})` : String(size);
                }),
                "GHI CHÚ"
            ]];

            const body = group.rows.map((row, index) => {
                const isOk = (Number(row.lot_balance) || 0) <= 0;
                return [
                    index + 1,
                    row.ry_number || "",
                    row.CRD || "",
                    row.shipping_round || "",
                    row.model_name || "",
                    row.total_shipped ?? 0,
                    isOk ? "OK" : (row.lot_balance ?? 0),
                    "ĐÔI",
                    row.article || "",
                    ...activeSizes.map(size => {
                        const value = row[sizeToCol(size)];
                        return value && Number(value) !== 0 ? value : "-";
                    }),
                    row.note || ""
                ];
            });

            autoTable(doc, {
                startY: currentY,
                head,
                body,
                theme: "grid",
                tableWidth: "wrap",
                styles: { font: "Roboto", fontSize: activeSizes.length > 15 ? 7 : 9, cellPadding: 2, valign: "middle", halign: "center", lineColor: [100, 100, 100] },
                headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: "bold" },
                margin: { left: 30, right: 30 },
            });
            currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 30;
        }

        doc.save(`GiaoHang_TraSua_${client.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
    };

    if (!isMounted) return null;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 overflow-hidden bg-slate-50 p-4 text-[14px] text-slate-800 lg:p-6">
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex shrink-0 items-start justify-between">
                    <div>
                        <h1 className="text-lg font-bold uppercase tracking-wide text-slate-800">Báo Biểu Giao Hàng Trả Sửa</h1>
                        <p className="mt-1 text-sm text-slate-400">Xem chi tiết lịch sử giao hàng đã sửa xong cho khách</p>
                    </div>
                </div>

                <div className="mb-4 flex shrink-0 flex-col items-center gap-4 sm:flex-row">
                    <Autocomplete
                        options={clients}
                        value={client || undefined}
                        disableClearable
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon
                        onChange={(_, newValue) => {
                            if (newValue) {
                                setClient(newValue);
                                setSharedClient(newValue);
                            }
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Khách hàng"
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px",
                                        borderRadius: "12px",
                                        backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderWidth: "1px" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" },
                                }}
                            />
                        )}
                        sx={{ width: "240px" }}
                    />

                    <Autocomplete
                        options={Array.from(new Set(rows.map(row => row.ry_number).filter(Boolean)))}
                        value={orderRyFilter || null}
                        freeSolo
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon
                        onInputChange={(_, newValue) => setOrderRyFilter(newValue)}
                        onChange={(_, newValue) => setOrderRyFilter(newValue || "")}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Mã đơn hàng..."
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px",
                                        borderRadius: "12px",
                                        backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderWidth: "1px" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" },
                                }}
                            />
                        )}
                        sx={{ width: "240px" }}
                    />

                    <button
                        onClick={() => exportPDF()}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1"
                        title="Xuất PDF"
                        disabled={!client || rows.length === 0}
                    >
                        <PdfFileIcon size={28} className="cursor-pointer" />
                    </button>
                </div>

                <div className="report-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-max min-w-full table-auto border-separate border-spacing-0 text-[14px]">
                        <thead className="sticky top-0 z-40 bg-slate-100">
                            <tr>
                                <th className="top-0 z-50 w-12 bg-slate-100 px-2 py-3 text-center font-bold text-slate-700 shadow-[inset_-1px_-1px_0_0_#e2e8f0] md:sticky md:left-0">STT</th>
                                <th className="top-0 z-50 whitespace-nowrap bg-slate-100 px-3 py-3 text-center font-bold text-slate-700 shadow-[inset_-1px_-1px_0_0_#e2e8f0] md:sticky md:left-[48px]">Đơn Hàng</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 md:sticky">Đợt</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 md:sticky">Article</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 md:sticky">Model Name</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 md:sticky">CRD</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 md:sticky">Product</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 md:sticky">SL Đơn Hàng</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 md:sticky">SL Tích Lũy</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 md:sticky">SL Ngày</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 md:sticky">SL Còn Lại</th>
                                <th className="top-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 md:sticky">Trạng Thái</th>
                                {entrySizes.map((size) => {
                                    const mapping = mappings.find(item => item.standard_size === String(size));
                                    return (
                                        <th key={size} className="top-0 w-11 border-b border-r border-slate-200 bg-slate-100 px-1 py-3 text-center font-bold text-slate-800 md:sticky">
                                            <div className="flex flex-col leading-tight">
                                                <span>{size}</span>
                                                {mapping && <span className="text-[10px] font-medium text-blue-600">({mapping.client_size})</span>}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="top-0 z-50 w-24 border-b border-l border-slate-200 bg-slate-100 px-3 py-3 text-center font-bold text-slate-700 md:sticky md:right-0">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((group) => (
                                <React.Fragment key={group.date}>
                                    <tr>
                                        <td className="sticky left-0 top-[44px] z-30 h-10 border-b border-slate-100 bg-[#f8fafc] shadow-[inset_-1px_0_0_0_#e2e8f0]"></td>
                                        <td className="sticky left-[48px] top-[44px] z-30 h-10 whitespace-nowrap border-b border-slate-100 bg-[#f8fafc] px-3 py-2 text-center text-[13px] font-bold uppercase tracking-wider text-blue-600 shadow-[inset_-1px_0_0_0_#e2e8f0]">
                                            {group.date}
                                        </td>
                                        <td colSpan={11 + entrySizes.length} className="sticky top-[44px] z-20 border-b border-slate-100 bg-[#f8fafc] px-4 py-2"></td>
                                    </tr>
                                    {group.rows.map((row, index) => {
                                        const status = (Number(row.lot_balance) || 0) === 0 ? "Ok" : "Not Ok";
                                        const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50";
                                        return (
                                            <tr key={row.id} className={`${rowBg} group transition-colors hover:bg-blue-50/20`}>
                                                <td className={`z-10 whitespace-nowrap px-3 py-2.5 text-center font-bold text-slate-800 shadow-[inset_-1px_-1px_0_0_#e2e8f0] group-hover:bg-blue-50 md:sticky md:left-0 ${rowBg}`}>{index + 1}</td>
                                                <td className={`z-10 whitespace-nowrap px-3 py-2.5 text-center font-bold text-slate-900 shadow-[inset_-1px_-1px_0_0_#e2e8f0] group-hover:bg-blue-50 md:sticky md:left-[48px] ${rowBg}`}>{row.ry_number}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-orange-600">{row.shipping_round || "-"}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#e59f67]">{row.article || "-"}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#e59f67]">{row.model_name || "-"}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-blue-600">{row.CRD || "-"}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#e59f67]">{row.product || "-"}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#3b82f6]">{row.total_order || 0}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#a855f7]">{row.accumulated_total || 0}</td>
                                                <td className="whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold text-[#0284c7]">{row.total_shipped || 0}</td>
                                                <td className={`whitespace-nowrap border-b border-r border-slate-100 px-3 py-2.5 text-center font-bold ${Number(row.lot_balance) === 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{row.lot_balance || 0}</td>
                                                <td className={`whitespace-nowrap border-b border-r border-slate-100 px-0 py-0 text-center align-middle ${status === "Ok" ? "bg-emerald-50 text-emerald-600" : "bg-[#fee2e2] text-rose-600"}`}>
                                                    <div className="flex min-h-[44px] w-full items-center justify-center whitespace-nowrap text-[13px] font-bold">{status}</div>
                                                </td>
                                                {entrySizes.map((size) => {
                                                    const value = row[sizeToCol(size)];
                                                    const isEmpty = !value || Number(value) === 0;
                                                    return (
                                                        <td key={size} className={`whitespace-nowrap border px-1 py-1 text-center text-[13px] font-semibold ${isEmpty ? "border-white bg-[#e2e8f0]" : "border-slate-200 bg-white"}`}>
                                                            {isEmpty ? null : value}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`z-20 whitespace-nowrap border-b border-l border-slate-100 px-2 py-2 group-hover:bg-blue-50 md:sticky md:right-0 ${rowBg}`}>
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => openEdit(row)} className="rounded-md p-1 text-[#3b82f6] transition-colors hover:bg-blue-100" title="Chỉnh sửa">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(row)} className="rounded-md p-1 text-[#ef4444] transition-colors hover:bg-red-50" title="Xóa">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>{snackbar.message}</Alert>
            </Snackbar>

            {editRow && (
                <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setEditRow(null)}>
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <div className="mb-6 flex items-center justify-between border-b pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Chỉnh sửa {editRow.ry_number}</h2>
                                <p className="mt-1 text-sm text-slate-500">Cập nhật ngày giao, ghi chú và số lượng size.</p>
                            </div>
                            <button onClick={() => setEditRow(null)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100">
                                <LucideX size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Ngày giao hàng</span>
                                <input type="date" value={editForm.date} onChange={(event) => setEditForm(prev => ({ ...prev, date: event.target.value }))} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 ${!editForm.date ? "bg-[#e2e8f0]" : "bg-white"}`} />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Ghi chú</span>
                                <input value={editForm.note} onChange={(event) => setEditForm(prev => ({ ...prev, note: event.target.value }))} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900 ${!editForm.note ? "bg-[#e2e8f0]" : "bg-white"}`} />
                            </label>
                        </div>

                        <div className="mt-8 grid grid-cols-4 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                            {entrySizes.map((size) => {
                                const mapping = mappings.find(item => item.standard_size === String(size));
                                const value = editForm.sizeValues[String(size)];
                                return (
                                    <label key={size} className="block">
                                        <span className="mb-1 flex flex-col items-center text-[10px] font-bold text-slate-400">
                                            <span>{size}</span>
                                            {mapping && <span className="text-blue-600">({mapping.client_size})</span>}
                                        </span>
                                        <input type="number" value={value === "0" || !value ? "" : value} onChange={(event) => setEditForm(prev => ({ ...prev, sizeValues: { ...prev.sizeValues, [String(size)]: event.target.value } }))} className={`w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-[13px] font-bold outline-none transition-all focus:border-slate-900 ${!value || value === "0" ? "bg-[#e2e8f0]" : "bg-white"}`} />
                                    </label>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
                            <button onClick={() => setEditRow(null)} className="cursor-pointer rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50">Hủy</button>
                            <button onClick={saveEdit} className="cursor-pointer rounded-xl bg-slate-950 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800">Lưu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
