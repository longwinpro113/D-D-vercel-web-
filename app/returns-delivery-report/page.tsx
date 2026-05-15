"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";
import { useSharedReportClient } from "@/lib/useSharedReportClient";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Snackbar, Alert } from "@mui/material";
import { ChevronDown, Trash2, Edit2 } from "lucide-react";
import { FaFilePdf } from "react-icons/fa6";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ReturnReportRow = {
    id: string | number;
    ry_number: string;
    shipped_date?: string;
    note?: string | null;
    shipping_round?: number | null;
    total_shipped?: number | null;
    [key: string]: any;
};

const autocompletePopupIcon = <ChevronDown size={16} />;

export default function ReturnsDeliveryReportPage() {
    const [sharedClient, setSharedClient] = useSharedReportClient();
    const [client, setClient] = useState<string | undefined>(sharedClient || "");
    const [clients, setClients] = useState<string[]>([]);
    const [rows, setRows] = useState<ReturnReportRow[]>([]);
    const [orderRyFilter, setOrderRyFilter] = useState("");
    const [mounted, setMounted] = useState(false);

    const [editModal, setEditModal] = useState<{
        open: boolean;
        row: ReturnReportRow | null;
    }>({ open: false, row: null });

    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    useEffect(() => { setMounted(true); }, []);

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const handleDelete = async (id: number | string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa dòng này?")) return;
        try {
            await axios.delete(`/api/returns/shipped?id=${id}&type=shipped`);
            setSnackbar({ open: true, message: "Đã xóa thành công!", severity: "success" });
            void fetchRows();
        } catch (err) {
            setSnackbar({ open: true, message: "Lỗi khi xóa dữ liệu.", severity: "error" });
        }
    };

    const handleUpdate = async (id: number | string, data: any) => {
        try {
            const total = entrySizes.reduce((sum, s) => sum + (Number(data[sizeToCol(s)]) || 0), 0);
            const updatePayload = {
                ...data,
                total_shipped: total
            };
            
            delete updatePayload.id;
            delete updatePayload.fmt_date;
            delete updatePayload.lot_balance;
            delete updatePayload.CRD;

            await axios.put(`/api/returns/shipped?id=${id}&type=shipped`, updatePayload);
            setSnackbar({ open: true, message: "Đã cập nhật thành công!", severity: "success" });
            setEditModal({ open: false, row: null });
            void fetchRows();
        } catch (err) {
            setSnackbar({ open: true, message: "Lỗi khi cập nhật dữ liệu.", severity: "error" });
        }
    };

    const isMounted = useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );

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

    const fetchRows = useCallback(async () => {
        if (!client) {
            setRows([]);
            return;
        }

        try {
            const params: Record<string, string> = { client };
            const res = await axios.get("/api/returns/shipped", { params });
            setRows(Array.isArray(res.data) ? (res.data as ReturnReportRow[]) : []);
        } catch (err) {
            console.error("[API] Fetch returns error:", err);
            setRows([]);
        }
    }, [client]);

    useEffect(() => {
        void fetchRows();
    }, [fetchRows]);

    const filteredRows = useMemo(() => {
        if (!orderRyFilter) return rows;
        const search = orderRyFilter.toLowerCase();
        return rows.filter(r => (r.ry_number || "").toLowerCase().includes(search));
    }, [rows, orderRyFilter]);

    const grouped = useMemo(() => {
        const map = new Map<string, ReturnReportRow[]>();
        filteredRows.forEach(row => {
            const date = row.shipped_date || "Không xác định";
            if (!map.has(date)) map.set(date, []);
            map.get(date)!.push(row);
        });
        return Array.from(map.entries()).map(([date, rows]) => ({ date, rows }));
    }, [filteredRows]);

    const exportPDF = () => {
        if (!client) return;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        
        doc.setFontSize(16);
        doc.text("BAO BIEU GIAO HANG TRA SUA", doc.internal.pageSize.width / 2, 40, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Khach hang: ${client}`, 40, 65);
        doc.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`, 40, 85);

        const tableHeaders = [
            "STT", "Ngay", "Don Hang", "Dot", "Article", "Model Name", "CRD", "Product", 
            "SL Don Hang", "Tich Luy", "SL Ngay", "Con Lai", "Trang Thai", ...entrySizes
        ];

        const tableRows: any[] = [];
        let stt = 1;
        grouped.forEach(group => {
            group.rows.forEach(row => {
                const status = (row.lot_balance ?? 0) <= 0 ? "Ok" : "Not Ok";
                tableRows.push([
                    stt++,
                    group.date,
                    row.ry_number,
                    row.shipping_round || "-",
                    row.article || "-",
                    row.model_name || "-",
                    row.CRD || "-",
                    row.product || "-",
                    row.total_order || 0,
                    row.accumulated_total || 0,
                    row.total_shipped || 0,
                    row.lot_balance || 0,
                    status,
                    ...entrySizes.map(s => {
                        const val = row[sizeToCol(s)];
                        return val ? val : "-";
                    })
                ]);
            });
        });

        autoTable(doc, {
            head: [tableHeaders],
            body: tableRows,
            startY: 100,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
        });

        doc.save(`GiaoHang_TraSua_${client}_${new Date().getTime()}.pdf`);
    };

    if (!isMounted) return null;

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 p-4 lg:p-6 overflow-hidden bg-slate-50 text-[14px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-start mb-6 shrink-0">
                    <div>
                        <h1 className="text-lg font-bold uppercase text-slate-800 tracking-wide">
                            Báo Biểu Giao Hàng Trả Sửa
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Xem chi tiết lịch sử giao hàng đã sửa xong cho khách
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-4 shrink-0 items-center">
                    <Autocomplete
                        options={clients}
                        value={(client || null) as any}
                        disableClearable
                        popupIcon={autocompletePopupIcon}
                        forcePopupIcon={true}
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
                                        "&.Mui-focused fieldset": { borderColor: "#000" },
                                    }
                                }}
                            />
                        )}
                        sx={{ width: "240px" }}
                    />

                    <TextField
                        placeholder="Tìm mã đơn hàng..."
                        variant="outlined"
                        value={orderRyFilter}
                        onChange={(e) => setOrderRyFilter(e.target.value)}
                        sx={{
                            width: "240px",
                            "& .MuiOutlinedInput-root": {
                                height: "42px", borderRadius: "12px", backgroundColor: "white",
                                "& fieldset": { borderColor: "#e2e8f0" },
                                "&.Mui-focused fieldset": { borderColor: "#000" },
                            }
                        }}
                    />

                    <button
                        onClick={exportPDF}
                        disabled={!client || rows.length === 0}
                        className="flex items-center justify-center text-rose-600 hover:text-rose-700 transition-all shrink-0 ml-1"
                        title="Xuất PDF"
                    >
                        <FaFilePdf size={28} className="cursor-pointer" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 report-scrollbar">
                    <table className="border-separate border-spacing-0 text-[13px] w-max min-w-full table-auto">
                        <thead className="sticky top-0 z-40 bg-slate-100">
                            <tr>
                                <th className="md:sticky md:left-0 top-0 z-50 bg-slate-100 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-2 py-3 text-center font-bold text-slate-700 w-12">STT</th>
                                <th className="md:sticky md:left-[48px] top-0 z-50 bg-slate-100 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-3 text-center font-bold text-slate-700 whitespace-nowrap">Đơn Hàng</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Đợt</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Article</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Model Name</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">CRD</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Product</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Đơn Hàng</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Tích Lũy</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Ngày</th>
                                <th className="md:sticky top-0 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">SL Còn Lại</th>
                                <th className="md:sticky top-0 bg-slate-100 px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">Trạng Thái</th>
                                {entrySizes.map((s) => (
                                    <th key={s} className="md:sticky top-0 bg-slate-100 border-b border-r border-slate-200 px-1 py-3 text-center font-bold text-slate-800 w-11">{s}</th>
                                ))}
                                <th className="md:sticky md:right-0 top-0 z-50 bg-slate-100 border-b border-l border-slate-200 px-3 py-3 text-center font-bold text-slate-700 w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((group) => (
                                <React.Fragment key={group.date}>
                                    <tr>
                                        <td className="sticky top-[44px] left-0 z-30 bg-[#f8fafc] border-b border-slate-100 h-10 shadow-[inset_-1px_0_0_0_#e2e8f0]"></td>
                                        <td className="sticky top-[44px] left-[48px] z-30 bg-[#f8fafc] border-b border-slate-100 h-10 shadow-[inset_-1px_0_0_0_#e2e8f0] px-3 py-2 text-center font-bold text-blue-600 uppercase tracking-wider text-[13px] whitespace-nowrap">
                                            {group.date}
                                        </td>
                                        <td colSpan={11 + entrySizes.length} className="sticky top-[44px] z-20 bg-[#f8fafc] border-b border-slate-100 px-4 py-2"></td>
                                    </tr>
                                    {group.rows.map((row, index) => {
                                        const status = (row.lot_balance ?? 0) <= 0 ? "Ok" : "Not Ok";
                                        const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50";
                                        return (
                                            <tr key={row.id} className={`${rowBg} hover:bg-blue-50/20 transition-colors group`}>
                                                <td className={`md:sticky md:left-0 z-10 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-2.5 font-bold text-slate-800 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50`}>
                                                    {index + 1}
                                                </td>
                                                <td className={`md:sticky md:left-[48px] z-10 shadow-[inset_-1px_-1px_0_0_#e2e8f0] px-3 py-2.5 font-bold text-slate-900 text-center whitespace-nowrap ${rowBg} group-hover:bg-blue-50`}>
                                                    {row.ry_number}
                                                </td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-orange-600 text-center whitespace-nowrap">{row.shipping_round || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.article || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.model_name || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-blue-600 text-center whitespace-nowrap">{row.CRD || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#e59f67] text-center whitespace-nowrap">{row.product || "-"}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#3b82f6] text-center whitespace-nowrap">{row.total_order || 0}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#a855f7] text-center whitespace-nowrap">{row.accumulated_total || 0}</td>
                                                <td className="border-b border-r border-slate-100 px-3 py-2.5 font-bold text-[#0284c7] text-center whitespace-nowrap">{row.total_shipped || 0}</td>
                                                <td className={`border-b border-r border-slate-100 px-3 py-2.5 font-bold text-center whitespace-nowrap ${row.lot_balance === 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                                                    {row.lot_balance || 0}
                                                </td>
                                                <td className={`px-0 py-0 border-b border-r border-slate-100 whitespace-nowrap text-center align-middle ${status === 'Ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#fee2e2] text-rose-600'}`}>
                                                    <div className="w-full h-full min-h-[44px] flex items-center justify-center font-bold text-[13px] whitespace-nowrap">
                                                        {status}
                                                    </div>
                                                </td>
                                                {entrySizes.map((s) => {
                                                    const val = row[sizeToCol(s)];
                                                    const isEmpty = !val || Number(val) === 0;
                                                    return (
                                                        <td key={s} className={`px-1 py-1 text-center border font-semibold text-[13px] whitespace-nowrap ${isEmpty ? 'border-white bg-[#e2e8f0]' : 'border-slate-200 bg-white'}`}>
                                                            {isEmpty ? null : val}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`md:sticky md:right-0 z-20 ${rowBg} border-l border-b border-slate-100 px-2 py-2 group-hover:bg-blue-50 whitespace-nowrap`}>
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => setEditModal({ open: true, row })} className="p-1 text-[#3b82f6] hover:bg-blue-100 rounded-md transition-colors" title="Chỉnh sửa">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(row.id)} className="p-1 text-[#ef4444] hover:bg-red-50 rounded-md transition-colors" title="Xóa">
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

            {/* Edit Modal */}
            <Dialog open={editModal.open} onClose={() => setEditModal({ open: false, row: null })} maxWidth="md" fullWidth
                sx={{ "& .MuiDialog-paper": { borderRadius: "16px" } }}>
                <DialogTitle className="font-bold text-slate-800 border-b border-slate-100">
                    Chỉnh sửa thông tin Trả Hàng
                </DialogTitle>
                <DialogContent className="pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {entrySizes.map((s) => (
                            <TextField
                                key={s}
                                label={`Size ${s}`}
                                type="number"
                                variant="outlined"
                                defaultValue={editModal.row ? editModal.row[sizeToCol(s)] : 0}
                                onChange={(e) => {
                                    if (editModal.row) {
                                        editModal.row[sizeToCol(s)] = Number(e.target.value);
                                    }
                                }}
                                size="small"
                                fullWidth
                            />
                        ))}
                    </div>
                </DialogContent>
                <DialogActions className="p-4 border-t border-slate-100">
                    <Button onClick={() => setEditModal({ open: false, row: null })} className="text-slate-500 font-bold">Hủy</Button>
                    <Button 
                        variant="contained" 
                        onClick={() => editModal.row && handleUpdate(editModal.row.id, editModal.row)}
                        className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-2 rounded-xl text-white"
                    >
                        Lưu thay đổi
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
            </Snackbar>
        </div>
    );
}
