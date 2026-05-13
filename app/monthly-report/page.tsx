"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { sizeToCol, sizes } from "@/lib/size";
import { useSharedReportClient } from "@/lib/useSharedReportClient";
import { type ClientRow } from "@/lib/types";

type MonthlyRow = {
    ry_number: string;
    delivery_round?: string | null;
    article?: string | null;
    model_name?: string | null;
    product?: string | null;
    total_quantity?: number | string | null;
    accumulated_total?: number | string | null;
    remaining_quantity?: number | string | null;
    [key: string]: string | number | null | undefined;
};

function toMonthInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function monthLabelToRange(monthValue: string) {
    const [yearText, monthText] = monthValue.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const from = new Date(year, monthIndex, 26);
    const to = new Date(year, monthIndex + 1, 25);
    return { from, to };
}

function formatDate(date: Date) {
    return date.toLocaleDateString("vi-VN");
}

export default function MonthlyReportPage() {
    const [sharedClient, setSharedClient] = useSharedReportClient();
    const [client, setClient] = useState(sharedClient || "");
    const [clients, setClients] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(toMonthInputValue(new Date()));
    const [rows, setRows] = useState<MonthlyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [overrides, setOverrides] = useState<Record<string, number>>({});

    useEffect(() => {
        const loadClients = async () => {
            console.log("[API] Loading clients for monthly report...");
            try {
                const res = await axios.get("/api/orders/clients");
                console.log("[API] Load clients success:", res.data);
                const list = Array.isArray(res.data)
                    ? (res.data as ClientRow[]).map((item) => item.client).filter((value): value is string => Boolean(value))
                    : [];
                setClients(list);
                if (!client && list.length > 0) {
                    setClient(list[0]);
                    setSharedClient(list[0]);
                }
            } catch (err) {
                console.error("[API] Load clients error:", err);
                setClients([]);
            }
        };
        void loadClients();
    }, [client, setSharedClient]);

    useEffect(() => {
        const loadMaxMonth = async () => {
            if (!client) return;
            console.log(`[API] Loading max month for client: ${client}`);
            try {
                const res = await axios.get(`/api/history-export/max-month?client=${encodeURIComponent(client)}`);
                console.log("[API] Load max month success:", res.data);
                if (res.data?.max_month) setSelectedMonth(res.data.max_month);
            } catch (err) {
                console.error("[API] Load max month error:", err);
            }
        };
        void loadMaxMonth();
    }, [client]);

    useEffect(() => {
        const loadRows = async () => {
            setLoading(true);
            const range = monthLabelToRange(selectedMonth);
            const closingDate = formatDate(range.to);
            console.log(`[API] Loading remaining-stock for client: ${client}, target: ${closingDate}`);
            try {
                const params: Record<string, string> = { q: closingDate };
                if (client) params.client = client;

                const res = await axios.get("/api/remaining-stock", { params });
                console.log("[API] Load remaining-stock success:", res.data);
                setRows(Array.isArray(res.data) ? (res.data as MonthlyRow[]) : []);

                const storageKey = client ? `monthly-report-draft:${client}` : "";
                if (storageKey) {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) {
                        const saved = JSON.parse(raw);
                        const monthValues = saved?.months?.[closingDate] || {};
                        setOverrides(
                            Object.fromEntries(
                                Object.entries(monthValues).map(([key, value]) => [key, Number(value) || 0]),
                            ),
                        );
                    } else {
                        setOverrides({});
                    }
                }
            } catch (err) {
                console.error("[API] Load remaining-stock error:", err);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };
        void loadRows();
    }, [client, selectedMonth]);

    const range = useMemo(() => monthLabelToRange(selectedMonth), [selectedMonth]);
    const closingDateLabel = useMemo(() => formatDate(range.to), [range]);
    const storageKey = useMemo(() => (client ? `monthly-report-draft:${client}` : ""), [client]);

    useEffect(() => {
        if (!storageKey) return;
        try {
            const existing = JSON.parse(localStorage.getItem(storageKey) || "{}");
            const next = {
                ...existing,
                months: {
                    ...(existing.months || {}),
                    [closingDateLabel]: overrides,
                },
            };
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            // ignore storage issues
        }
    }, [closingDateLabel, overrides, storageKey]);

    return (
        <div className="mx-auto flex h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] w-full flex-col gap-4 overflow-hidden bg-slate-50 p-4 text-[13px] lg:p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex min-h-0 flex-col">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-950">Báo Cáo Công Nợ</h1>
                        <p className="text-sm text-slate-500">Điều chỉnh projected total và lưu nháp theo khách hàng/tháng.</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            placeholder="-"
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-900"
                        />
                        <select
                            title="-"
                            value={client}
                            onChange={(e) => {
                                setClient(e.target.value);
                                setSharedClient(e.target.value);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-900"
                        >
                            <option value="">Tất cả khách hàng</option>
                            {clients.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Kỳ chốt: {closingDateLabel}</div>

                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 touch-pan-x overscroll-x-contain">
                    <table className="min-w-[1800px] border-collapse text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">#</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">Đơn Hàng</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">Đợt</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">Article</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">Model</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">CRD</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">Product</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">SL đơn hàng</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">SL dự kiến</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">SL thực tế</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">SL còn lại</th>
                                <th className="border-b border-slate-200 px-3 py-3 text-left">Trạng thái</th>
                                {sizes.map((size) => (
                                    <th key={size} className="border-b border-slate-200 px-2 py-3 text-center text-xs">
                                        {size}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => {
                                const actual = Number(row.accumulated_total) || 0;
                                const projected = overrides[row.ry_number] !== undefined ? overrides[row.ry_number] : actual;
                                const remaining = Math.max((Number(row.total_quantity) || 0) - projected, 0);
                                const isOk = remaining <= 0;

                                return (
                                    <tr key={`${row.ry_number}-${index}`} className="odd:bg-white even:bg-slate-50/50">
                                        <td className="border-b border-slate-100 px-3 py-2">{index + 1}</td>
                                        <td className="border-b border-slate-100 px-3 py-2 font-semibold">{row.ry_number}</td>
                                        <td className="border-b border-slate-100 px-3 py-2">{row.delivery_round || "-"}</td>
                                        <td className="border-b border-slate-100 px-3 py-2">{row.article || "-"}</td>
                                        <td className="border-b border-slate-100 px-3 py-2">{row.model_name || "-"}</td>
                                        <td className="border-b border-slate-100 px-3 py-2 font-semibold text-blue-600">{row.CRD || "-"}</td>
                                        <td className="border-b border-slate-100 px-3 py-2">{row.product || "-"}</td>
                                        <td className="border-b border-slate-100 px-3 py-2 font-semibold">{row.total_quantity ?? 0}</td>
                                        <td className="border-b border-slate-100 px-3 py-2">
                                            <input
                                                placeholder="-"
                                                type="number"
                                                value={projected}
                                                onChange={(e) =>
                                                    setOverrides((prev) => ({
                                                        ...prev,
                                                        [row.ry_number]: Number(e.target.value) || 0,
                                                    }))
                                                }
                                                className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
                                            />
                                        </td>
                                        <td className="border-b border-slate-100 px-3 py-2 font-semibold">{actual}</td>
                                        <td className="border-b border-slate-100 px-3 py-2 font-semibold">{remaining}</td>
                                        <td className={`border-b border-slate-100 px-3 py-2 font-semibold ${isOk ? "text-emerald-700" : "text-rose-700"}`}>
                                            {isOk ? "OK" : "Not OK"}
                                        </td>
                                        {sizes.map((size) => {
                                            const key = sizeToCol(size);
                                            const orderKey = `o${key}`;
                                            const hasOrder = Number(row[orderKey]) > 0;
                                            const value = row[key];
                                            return (
                                                <td key={size} className="border-b border-slate-100 px-2 py-2 text-center text-xs">
                                                    {!hasOrder ? "" : Number(value) > 0 ? value : "Ok"}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td className="px-4 py-8 text-center text-slate-500" colSpan={12 + sizes.length}>
                                        Không có dữ liệu phù hợp.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
