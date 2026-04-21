"use client";

import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { Dayjs } from "dayjs";
import { Snackbar, Alert, type AlertColor } from "@mui/material";
import { ChevronDown, Save, RotateCcw } from "lucide-react";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";

type RequiredFieldKey = "customer" | "article" | "order" | "delivery";

const defaultProductOptions = ["BTP Chặt", "BTP In", "TP Laban", "TP Quai", "TP Lưỡi Gà"];

export default function OrdersEntryFormPage() {
    const [exportPortDate, setExportPortDate] = useState<Dayjs | null>(null);
    const [exportGoodsDate, setExportGoodsDate] = useState<Dayjs | null>(null);
    const [importGoodsDate, setImportGoodsDate] = useState<Dayjs | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
        open: false,
        message: "",
        severity: "success",
    });

    const [formValues, setFormValues] = useState({
        customer: "",
        article: "",
        order: "",
        delivery: "",
        modelName: "",
        product: "",
    });

    const [clientOptions, setClientOptions] = useState<string[]>([]);
    const [articleOptions, setArticleOptions] = useState<string[]>([]);
    const [orderOptions, setOrderOptions] = useState<string[]>([]);
    const [modelOptions, setModelOptions] = useState<string[]>([]);
    const [productOptions, setProductOptions] = useState<string[]>(defaultProductOptions);
    const [sizeValues, setSizeValues] = useState<Record<string, string>>({});
    const [missingRequiredFields, setMissingRequiredFields] = useState<RequiredFieldKey[]>([]);

    const totalSize = useMemo(
        () => entrySizes.reduce((sum, size) => sum + (parseFloat(sizeValues[size]) || 0), 0),
        [sizeValues],
    );

    const handleCloseSnackbar = (_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    useEffect(() => {
        axios.get("/api/suggestions?field=client").then((res) => {
            setClientOptions(Array.isArray(res.data) ? (res.data as string[]) : []);
        }).catch((err) => console.error("[API] Error fetching clients:", err));
    }, []);

    useEffect(() => {
        if (!formValues.customer) {
            setArticleOptions([]);
            setOrderOptions([]);
            setModelOptions([]);
            setProductOptions(defaultProductOptions);
            return;
        }

        const fetchField = (field: string, setter: (val: string[]) => void) => {
            axios.get(`/api/suggestions?field=${field}&client=${encodeURIComponent(formValues.customer)}`).then((res) => {
                setter(Array.isArray(res.data) ? (res.data as string[]) : []);
            }).catch((err) => console.error(`[API] Error fetching ${field}:`, err));
        };

        fetchField("article", setArticleOptions);
        fetchField("ry_number", setOrderOptions);
        fetchField("model_name", setModelOptions);
        fetchField("product", (items) => setProductOptions(Array.from(new Set([...defaultProductOptions, ...items]))));
    }, [formValues.customer]);

    const handleReset = () => {
        setExportPortDate(null);
        setExportGoodsDate(null);
        setImportGoodsDate(null);
        setMissingRequiredFields([]);
        setFormValues({ customer: "", article: "", order: "", delivery: "", modelName: "", product: "" });
        setSizeValues({});
    };

    const requiredLabel = (label: string, key: RequiredFieldKey) => (
        <>
            <span>{label}</span>
            <span className={missingRequiredFields.includes(key) ? "text-rose-500" : "text-slate-400"}> *</span>
        </>
    );

    const updateRequiredField = (key: RequiredFieldKey, value: string) => {
        setFormValues((prev) => ({ ...prev, [key]: value }));
        setMissingRequiredFields((prev) => (value.trim() ? prev.filter((item) => item !== key) : prev));
    };

    const handleSave = async () => {
        const required = ["customer", "article", "order", "delivery"] as const;
        const missing = required.filter(k => !formValues[k]);
        setMissingRequiredFields(missing as RequiredFieldKey[]);
        if (missing.length > 0) {
            setSnackbar({ open: true, message: "Vui lòng nhập đầy đủ các trường bắt buộc.", severity: "error" });
            return;
        }

        const enteredSizes = Object.entries(sizeValues).filter(([, val]) => parseFloat(val) > 0);
        if (enteredSizes.length === 0) {
            setSnackbar({ open: true, message: "Vui lòng nhập số lượng size.", severity: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const totalQty = enteredSizes.reduce((acc, [, val]) => acc + (parseFloat(val) || 0), 0);
            const payload: Record<string, string | number | null> = {
                client: formValues.customer,
                article: formValues.article,
                ry_number: formValues.order,
                delivery_round: formValues.delivery,
                model_name: formValues.modelName,
                product: formValues.product,
                CRD: exportPortDate?.format("YYYY-MM-DD") || null,
                client_export_date: exportGoodsDate?.format("YYYY-MM-DD") || null,
                client_import_date: importGoodsDate?.format("YYYY-MM-DD") || null,
                total_order_qty: totalQty,
            };
            entrySizes.forEach((size) => { payload[sizeToCol(size)] = parseFloat(sizeValues[size]) || 0; });
            await axios.post("/api/orders", payload);
            setSnackbar({ open: true, message: "Lưu đơn hàng thành công!", severity: "success" });
            handleReset();
        } catch (error: any) {
            console.error("[API] Error saving order:", error);
            const isDuplicate = error.response?.status === 409 || error.response?.data?.error === "DUPLICATE_ENTRY";
            setSnackbar({ 
                open: true, 
                message: isDuplicate ? "Dữ liệu đã tồn tại (mã PO/RY này đã có)." : "Lỗi khi lưu đơn hàng.", 
                severity: "error" 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getSharedTextFieldSx = (value: string | null | undefined) => ({
        "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            backgroundColor: !value ? "#e2e8f0" : "#ffffff",
            "& input, & textarea": { color: value ? "#000" : "inherit", fontWeight: value ? "600" : "normal" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
        },
        "& .MuiInputLabel-root.Mui-focused": { color: "#000" },
    });

    return (
        <Box className="w-full h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] overflow-hidden bg-gray-50 p-2 lg:p-4 text-gray-800 flex flex-col">
            <Box className="w-full min-h-0 bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-y-auto no-scrollbar">
                <Box className="flex justify-between items-center mb-3 shrink-0">
                    <h1 className="text-xl font-bold text-black">Nhập Thông Tin Đơn Hàng Mới</h1>
                </Box>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box component="section" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 4 }}>
                        {[
                            { label: "Khách hàng", key: "customer", options: clientOptions, mandatory: true },
                            { label: "Article", key: "article", options: articleOptions, mandatory: true },
                            { label: "Ry (PO)", key: "order", options: orderOptions, mandatory: true },
                            { label: "Model Name", key: "modelName", options: modelOptions, mandatory: false },
                            { label: "Sản Phẩm", key: "product", options: productOptions, mandatory: false },
                            { label: "Đợt Xuống Hàng", key: "delivery", options: (formValues.customer ? Array.from({ length: 10 }, (_, i) => `DHD${i + 1}`) : []), mandatory: true }
                        ].map((field) => (
                            <Autocomplete
                                key={field.key}
                                freeSolo={field.key !== "delivery"}
                                options={field.options}
                                value={formValues[field.key as keyof typeof formValues] || null}
                                onChange={(_, newValue) => updateRequiredField(field.key as RequiredFieldKey, newValue || "")}
                                onInputChange={(_, newInputValue) => updateRequiredField(field.key as RequiredFieldKey, newInputValue)}
                                slotProps={{ listbox: { style: { maxHeight: 200 } } }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={field.mandatory ? requiredLabel(field.label, field.key as RequiredFieldKey) : field.label}
                                        variant="outlined"
                                        fullWidth
                                        sx={getSharedTextFieldSx(formValues[field.key as keyof typeof formValues])}
                                    />
                                )}
                            />
                        ))}

                        <DatePicker label="CRD (Ngày Xuất Cảng)" value={exportPortDate} onChange={(v) => setExportPortDate(v)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(exportPortDate?.toString()) } }} />
                        <DatePicker label="Ngày Xuất Kho" value={exportGoodsDate} onChange={(v) => setExportGoodsDate(v)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(exportGoodsDate?.toString()) } }} />
                        <DatePicker label="Ngày Nhập Kho" value={importGoodsDate} onChange={(v) => setImportGoodsDate(v)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(importGoodsDate?.toString()) } }} />
                    </Box>
                </LocalizationProvider>

                <Box className="flex-1 flex min-h-0 flex-col overflow-hidden">
                    <Box className="flex items-center gap-4 mb-4 shrink-0">
                        <h2 className="text-lg font-bold text-black border-none m-0">Nhập số lượng size</h2>
                        <Box className={`rounded-xl bg-black px-4 py-2 text-[15px] font-bold text-white shadow-sm transition-opacity duration-200 ${totalSize > 0 ? "opacity-100" : "opacity-0"}`}>Tổng: {totalSize}</Box>
                    </Box>
                    <Box className="grid flex-1 min-h-0 grid-cols-3 gap-x-3 gap-y-5 overflow-y-auto pr-1 pt-1 pb-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 no-scrollbar">
                        {entrySizes.map((size) => (
                            <Box key={size} className="flex flex-col items-center">
                                <span className="text-[14px] font-semibold mb-0.5 text-gray-700 leading-none">{size}</span>
                                <input type="number" value={sizeValues[size] || ""} onChange={(e) => setSizeValues((prev) => ({ ...prev, [size]: e.target.value }))} className={`w-full h-12 px-2 border border-gray-200 rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-black transition-all ${!sizeValues[size] ? "bg-gray-100" : "bg-white"}`} />
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box className="flex gap-4 mt-2 pt-4 border-t border-gray-100 shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-sm text-sm"><Save size={16} />{isSaving ? "Đang lưu..." : "Lưu Đơn Hàng"}</button>
                    <button onClick={handleReset} disabled={isSaving} className="flex items-center gap-2 bg-white border border-black text-black hover:bg-gray-50 px-6 py-2 rounded-lg font-semibold transition-colors text-sm"><RotateCcw size={16} />Làm mới</button>
                </Box>
            </Box>
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>{snackbar.message}</Alert></Snackbar>
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                input[type='number']::-webkit-inner-spin-button,
                input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type='number'] { -moz-appearance: textfield; }
            `}</style>
        </Box>
    );
}
