"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { sizes, entrySizes, sizeToCol } from "@/lib/size";
import { getErrorMessage } from "../../lib/types";
import { formatVnDate } from "@/lib/shared";
type OrderRow = {
    id: string | number;
    ry_number: string;
    article?: string | null;
    model_name?: string | null;
    product?: string | null;
    delivery_round?: string | null;
    CRD?: string | null;
    client?: string | null;
    [key: string]: string | number | null | undefined;
};
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);
import { ChevronDown, X as LucideX, Edit, Trash2, Search, RotateCcw, FileText } from "lucide-react";
import { FaFilePdf } from "react-icons/fa6";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function ClientOrdersPage() {
    const [client, setClient] = useState<string | null>(null);
    const [orderRy, setOrderRy] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [clients, setClients] = useState<string[]>([]);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [rows, setRows] = useState<OrderRow[]>([]);
    const [editRow, setEditRow] = useState<OrderRow | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<OrderRow | null>(null);
    const [editForm, setEditForm] = useState({
        client: "",
        article: "",
        ry_number: "",
        delivery_round: "",
        CRD: "",
        model_name: "",
        product: "",
        sizeValues: {} as Record<string, string>,
    });
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const lastClientRef = useRef("");

    useEffect(() => {
        setMounted(true);
        const loadInitialData = async () => {
            try {
                const [clientsRes, ordersRes] = await Promise.all([
                    axios.get("/api/orders/clients"),
                    axios.get("/api/orders"),
                ]);
                const clientList = Array.isArray(clientsRes.data)
                    ? (clientsRes.data as Array<{ client?: string }>)
                        .map((item) => item.client)
                        .filter((v): v is string => Boolean(v))
                    : [];
                setClients(clientList);
                if (clientList.length > 0) {
                    setClient(clientList[0]);
                    lastClientRef.current = clientList[0];
                }
                setOrders(Array.isArray(ordersRes.data) ? (ordersRes.data as OrderRow[]) : []);
            } catch (err) {
                console.error("[API] Load initial data error:", err);
            }
        };
        void loadInitialData();
    }, []);

    const fetchRows = useCallback(async (clientName: string) => {
        try {
            const params = new URLSearchParams();
            if (clientName) params.append("client", clientName);
            const res = await axios.get(`/api/orders?${params.toString()}`);
            setRows(Array.isArray(res.data) ? (res.data as OrderRow[]) : []);
        } catch (err) {
            console.error("[API] Fetch rows error:", err);
            setRows([]);
        }
    }, []);

    useEffect(() => {
        if (mounted && client) {
            void fetchRows(client || "");
        }
    }, [client, mounted, fetchRows]);

    const filteredRows = React.useMemo(() => {
        if (!orderRy) return rows;
        return rows.filter(r => r.ry_number === orderRy);
    }, [rows, orderRy]);

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    const openEdit = (row: OrderRow) => {
        const sv: Record<string, string> = {};
        entrySizes.forEach((s) => {
            sv[s] = String(row[sizeToCol(s)] ?? 0);
        });
        setEditForm({
            client: row.client || "",
            article: row.article || "",
            ry_number: row.ry_number || "",
            delivery_round: row.delivery_round || "",
            CRD: row.CRD || "",
            model_name: row.model_name || "",
            product: row.product || "",
            sizeValues: sv,
        });
        setEditRow(row);
    };

    const saveEdit = async () => {
        if (!editRow) return;
        const payload: Record<string, string | number | null> = {
            client: editForm.client || null,
            article: editForm.article || null,
            ry_number: editForm.ry_number || null,
            delivery_round: editForm.delivery_round || null,
            CRD: editForm.CRD || null,
            model_name: editForm.model_name || null,
            product: editForm.product || null,
        };
        entrySizes.forEach((size) => {
            payload[sizeToCol(size)] = Number(editForm.sizeValues[size]) || 0;
        });

        try {
            await axios.patch(`/api/orders/${editRow.ry_number}`, payload);
            setSnackbar({ open: true, message: "Cập nhật đơn hàng thành công.", severity: "success" });
            setEditRow(null);
            void fetchRows(client || "");
        } catch (error: any) {
            console.error("[API] Update error:", error);
            const isDuplicate = error.response?.status === 409 || error.response?.data?.error === "DUPLICATE_ENTRY";
            const errMsg = isDuplicate
                ? "Dữ liệu đã tồn tại (mã PO/RY này đã được sử dụng)."
                : (getErrorMessage(error, "Cập nhật thất bại."));
            setSnackbar({ open: true, message: errMsg, severity: "error" });
        }
    };

    const deleteRow = async () => {
        if (!deleteConfirm) return;
        try {
            await axios.delete(`/api/orders/${deleteConfirm.ry_number}`);
            setSnackbar({ open: true, message: "Đã xóa đơn hàng thành công.", severity: "success" });
            setDeleteConfirm(null);
            void fetchRows(client || "");
        } catch (error: unknown) {
            console.error("[API] Delete error:", error);
            const errorResponse = error as { response?: { data?: { error?: string } }; message?: string };
            const errMsg = errorResponse.response?.data?.error || errorResponse.message || "Xóa thất bại.";
            setSnackbar({ open: true, message: errMsg, severity: "error" });
        }
    };

    const exportPdf = async () => {
        if (filteredRows.length === 0) return;
        
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            
            // --- 1. Load Font ---
            try {
                const fontUrl = "https://unpkg.com/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf";
                const res = await fetch(fontUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    const base64Font = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    doc.addFileToVFS('Roboto-Regular.ttf', base64Font as string);
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
                    doc.setFont('Roboto');
                }
            } catch(e) { console.warn("Font error", e); }

            const pageWidth = doc.internal.pageSize.getWidth();
            let currentY = 40;

            doc.setFont('Roboto', 'bold');
            doc.setFontSize(16);
            doc.text("DANH SÁCH ĐƠN HÀNG", 30, currentY);
            currentY += 20;
            
            doc.setFont('Roboto', 'normal');
            doc.setFontSize(10);
            doc.text(`KHÁCH HÀNG: ${(client || "Tất cả").toUpperCase()}`, 30, currentY);
            doc.text(`Ngày in: ${new Date().toLocaleDateString("vi-VN")}`, pageWidth - 30, currentY, { align: "right" });
            currentY += 30;

            // Determine active sizes
            let activeSizes = entrySizes.filter(s => {
                return filteredRows.some(row => (parseFloat(String(row[sizeToCol(s)])) || 0) > 0);
            });
            if (activeSizes.length === 0 && entrySizes.length > 0) activeSizes = [entrySizes[0]];

            const head = [[
                "STT", "ĐƠN HÀNG", "ARTICLE", "MODEL NAME", "SẢN PHẨM", "ĐỢT", "CRD", "TỔNG", ...activeSizes.map(String)
            ]];

            const body = filteredRows.map((row, i) => [
                i + 1,
                row.ry_number || "",
                row.article || "",
                row.model_name || "",
                row.product || "",
                row.delivery_round || "",
                row.CRD || "",
                entrySizes.reduce((sum, s) => sum + (Number(row[sizeToCol(s)]) || 0), 0),
                ...activeSizes.map(s => row[sizeToCol(s)] || "-")
            ]);

            autoTable(doc, {
                startY: currentY,
                head: head,
                body: body,
                theme: 'grid',
                tableWidth: 'wrap', // Fit content
                styles: { font: 'Roboto', fontSize: activeSizes.length > 12 ? 7 : 8, cellPadding: 3, valign: 'middle', halign: 'center' },
                headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
                margin: { left: 30, right: 30 },
            });

            doc.save(`Danh_Sach_Don_Hang_${(client || "All").replace(/\s+/g, '_')}.pdf`);
        } catch (error: any) {
            console.error("PDF Export error:", error);
            alert("Lỗi xuất PDF: " + error.message);
        }
    };

    if (!mounted) return <div className="bg-slate-50 min-h-screen" />;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[13px]">
            <style jsx global>{`
                input[type='number']::-webkit-inner-spin-button,
                input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type='number'] { -moz-appearance: textfield; }
            `}</style>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-slate-950">Danh Sách Đơn Hàng</h1>
                        <p className="text-sm text-slate-500">Theo dõi và quản lý các đơn hàng hiện có.</p>
                    </div>
                </div>

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
                    <Autocomplete
                        options={clients}
                        value={(client || null) as any}
                        disableClearable
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onChange={(_, newValue) => {
                            if (newValue) {
                                setClient(newValue);
                                lastClientRef.current = newValue;
                                setOrderRy(""); // Clear RY when client changes
                            }
                        }}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Tất cả khách hàng" variant="outlined" fullWidth
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px", borderRadius: "12px", backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderWidth: "1px" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" }
                                }}
                            />
                        )}
                        sx={{
                            width: "240px",
                            '& .MuiAutocomplete-endAdornment': { right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' },
                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9 !important', borderRadius: '999px',
                            },
                            '& .MuiAutocomplete-clearIndicator svg, & .MuiAutocomplete-popupIndicator svg': { width: 16, height: 16, color: '#374151' },
                        }}
                    />

                    <Autocomplete
                        options={Array.from(new Set(rows.map((o) => o.ry_number)))}
                        value={(orderRy || null) as any}
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
                        onChange={(_, newValue) => setOrderRy(newValue)}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Tìm mã đơn hàng..." variant="outlined" fullWidth
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        height: "42px", borderRadius: "12px", backgroundColor: "white",
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                        "&:hover fieldset": { borderColor: "#cbd5e1" },
                                        "&.Mui-focused fieldset": { borderColor: "#3b82f6", borderWidth: "1px" },
                                    },
                                    "& .MuiInputBase-input": { fontSize: "1rem", color: "#1e293b", fontWeight: "500" }
                                }}
                            />
                        )}
                        sx={{
                            width: "240px",
                            '& .MuiAutocomplete-endAdornment': { right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', alignItems: 'center' },
                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9 !important', borderRadius: '999px',
                            },
                            '& .MuiAutocomplete-clearIndicator svg, & .MuiAutocomplete-popupIndicator svg': { width: 16, height: 16, color: '#374151' },
                        }}
                    />

                    <button
                        onClick={exportPdf}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1"
                        title="Xuất PDF"
                        disabled={!client || rows.length === 0}
                    >
                        <FaFilePdf size={28} className="cursor-pointer" />
                    </button>

                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 touch-pan-x overscroll-x-contain report-scrollbar">
                    <table className="border-collapse text-sm w-max min-w-full table-auto report-scrollbar">
                        <thead className="sticky top-0 z-40 bg-slate-100 text-slate-600">
                            <tr className="border-b border-slate-200">
                                <th className="sticky left-0 z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 w-12 border-r border-transparent shadow-[inset_-1px_0_0_0_#e2e8f0]">STT</th>
                                <th className="sticky left-12 z-50 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-transparent shadow-[inset_-1px_0_0_0_#e2e8f0]">ĐƠN HÀNG (RY)</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">ARTICLE</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">MODEL NAME</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">SẢN PHẨM</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">ĐỢT</th>
                                <th className="bg-slate-100 px-4 py-3 text-center font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">CRD</th>
                                <th className="bg-slate-200 px-4 py-3 text-center font-bold text-blue-800 whitespace-nowrap border-r border-slate-100">TỔNG</th>
                                {
                                    entrySizes.map((s) => (
                                        <th key={s} className="bg-slate-100 px-1 py-3 text-center font-bold text-slate-800 w-12 border border-white">{s}</th>
                                    ))}
                                <th className="sticky right-0 z-40 bg-slate-100 px-3 py-3 text-center font-bold text-slate-800 w-24 border-l border-slate-100">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, idx) => {
                                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
                                return (
                                    <tr key={row.ry_number || idx} className={`${rowBg} hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0`}>
                                        <td className={`sticky left-0 z-20 ${rowBg} px-3 py-2 text-center font-bold border-r border-transparent shadow-[inset_-1px_0_0_0_#e2e8f0]`}>{idx + 1}</td>
                                        <td className={`sticky left-12 z-20 ${rowBg} px-3 py-2 text-center font-bold text-emerald-700 whitespace-nowrap border-r border-transparent shadow-[inset_-1px_0_0_0_#e2e8f0]`}>{row.ry_number}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-700 whitespace-nowrap border-r border-slate-100">{row.article || "-"}</td>
                                        <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-100">{row.model_name || "-"}</td>
                                        <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-100">{row.product || "-"}</td>
                                        <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-100">{row.delivery_round || "-"}</td>
                                        <td className="px-4 py-2 text-center font-medium whitespace-nowrap border-r border-slate-100 text-blue-600">{row.CRD || "-"}</td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-700 bg-blue-50/30 whitespace-nowrap border-r border-slate-100">
                                            {entrySizes.reduce((sum, s) => sum + (Number(row[sizeToCol(s)]) || 0), 0)}
                                        </td>
                                        {entrySizes.map((s) => {
                                            const val = row[sizeToCol(s)];
                                            const isZero = !val || Number(val) === 0;
                                            return (
                                                <td key={s} className={`px-1 py-1 text-center font-bold border ${isZero ? "border-white bg-[#e2e8f0] text-transparent select-none" : "border-slate-200 bg-white text-emerald-700"}`}>
                                                    {isZero ? "" : val}
                                                </td>
                                            );
                                        })}
                                        <td className={`sticky right-0 z-20 ${rowBg} px-3 py-2 text-center border-l border-slate-100`}>
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => openEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={16} /></button>
                                                <button onClick={() => setDeleteConfirm(row)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {editRow && (
                <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditRow(null)}>
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6 flex items-center justify-between border-b pb-4">
                            <h2 className="text-xl font-bold text-slate-900">Sửa Đơn Hàng: {editRow.ry_number}</h2>
                            <button onClick={() => setEditRow(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><LucideX size={20} /></button>
                        </div>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            <TextField label="Khách hàng" fullWidth value={editForm.client} onChange={(e) => setEditForm({ ...editForm, client: e.target.value })} />
                            <TextField label="Article" fullWidth value={editForm.article} onChange={(e) => setEditForm({ ...editForm, article: e.target.value })} />
                            <TextField label="RY (PO)" fullWidth value={editForm.ry_number} onChange={(e) => setEditForm({ ...editForm, ry_number: e.target.value })} />
                            <TextField label="Model Name" fullWidth value={editForm.model_name} onChange={(e) => setEditForm({ ...editForm, model_name: e.target.value })} />
                            <TextField label="Sản Phẩm" fullWidth value={editForm.product} onChange={(e) => setEditForm({ ...editForm, product: e.target.value })} />
                            <TextField label="Đợt Xuống Hàng" fullWidth value={editForm.delivery_round} onChange={(e) => setEditForm({ ...editForm, delivery_round: e.target.value })} />
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DatePicker
                                    label="Ngày Xuất Hàng (CRD)"
                                    value={editForm.CRD ? dayjs(editForm.CRD, "DD/MM/YYYY") : null}
                                    onChange={(newValue) => setEditForm({ ...editForm, CRD: newValue ? newValue.format("DD/MM/YYYY") : "" })}
                                    format="DD/MM/YYYY"
                                    slotProps={{ textField: { fullWidth: true } }}
                                />
                            </LocalizationProvider>
                        </div>
                        <div className="mt-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 bg-slate-50 p-4 rounded-2xl">
                            {entrySizes.map((s) => (
                                <div key={s} className="flex flex-col gap-1">
                                    <span className="text-center text-[10px] font-bold text-slate-400 capitalize">{s}</span>
                                    <input type="number" value={editForm.sizeValues[s] || ""} onChange={(e) => setEditForm({ ...editForm, sizeValues: { ...editForm.sizeValues, [s]: e.target.value } })} className="w-full rounded-lg border border-slate-200 p-2 text-center text-sm font-bold focus:border-blue-500 outline-none" />
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 flex justify-end gap-3 border-t pt-6">
                            <button onClick={() => setEditRow(null)} className="cursor-pointer rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                            <button onClick={saveEdit} className="cursor-pointer rounded-xl bg-slate-950 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%', borderRadius: '12px', fontWeight: 500 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Dialog
                open={Boolean(deleteConfirm)}
                onClose={() => setDeleteConfirm(null)}
                slotProps={{
                    paper: {
                        sx: { borderRadius: "16px", padding: "8px", width: "400px" }
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Xác nhận xóa</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bạn có chắc chắn muốn xóa đơn hàng <strong>{deleteConfirm?.ry_number}</strong>? 
                        Hành động này không thể hoàn tác.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button 
                        onClick={() => setDeleteConfirm(null)} 
                        variant="outlined" 
                        sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, color: "#64748b", borderColor: "#e2e8f0" }}
                    >
                        Hủy
                    </Button>
                    <Button 
                        onClick={deleteRow} 
                        variant="contained" 
                        color="error" 
                        autoFocus 
                        sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none" } }}
                    >
                        Xác nhận xóa
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
