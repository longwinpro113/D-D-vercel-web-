"use client";

import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import { Snackbar, Alert, type AlertColor, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { Save, RotateCcw } from "lucide-react";
import axios from "axios";
import { entrySizes, sizeToCol } from "@/lib/size";

type OrderRecord = {
    ry_number: string;
    article?: string;
    model_name?: string;
    product?: string;
    delivery_round?: string | null;
    CRD?: string | null;
};

type RequiredFieldKey = "customer" | "order" | "delivery";

export default function ReturnsEntryFormPage() {
    const [entryType, setEntryType] = useState<"received" | "shipped">("received");
    const [entryDate, setEntryDate] = useState<Dayjs | null>(dayjs());
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
        open: false,
        message: "",
        severity: "success",
    });

    const [formValues, setFormValues] = useState<{
        customer: string | null;
        order: string | null;
        delivery: string | null;
        note: string;
    }>({
        customer: null,
        order: null,
        delivery: "Lô 1",
        note: "",
    });

    const [clientOptions, setClientOptions] = useState<string[]>([]);
    const [orders, setOrders] = useState<OrderRecord[]>([]);
    const [sizeValues, setSizeValues] = useState<Record<string, string>>({});
    const [missingRequiredFields, setMissingRequiredFields] = useState<RequiredFieldKey[]>([]);

    const selectedOrder = useMemo(() => orders.find(o => o.ry_number === formValues.order) || null, [formValues.order, orders]);

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
            setOrders([]);
            return;
        }

        axios.get(`/api/orders?client=${encodeURIComponent(formValues.customer)}`).then((res) => {
            setOrders(Array.isArray(res.data) ? (res.data as OrderRecord[]) : []);
        }).catch((err) => console.error(`[API] Error fetching orders:`, err));
    }, [formValues.customer]);

    const handleReset = () => {
        setEntryDate(dayjs());
        setFormValues({ customer: null, order: null, delivery: "Lô 1", note: "" });
        setSizeValues({});
        setMissingRequiredFields([]);
    };

    const requiredLabel = (label: string, key: RequiredFieldKey) => (
        <>
            <span>{label}</span>
            <span className={missingRequiredFields.includes(key) ? "text-rose-500" : "text-slate-400"}> *</span>
        </>
    );

    const updateRequiredField = (key: RequiredFieldKey, value: string | null) => {
        setFormValues((prev) => ({ ...prev, [key]: value }));
        if (value && value.trim()) {
            setMissingRequiredFields((prev) => prev.filter((k) => k !== key));
        }
    };

    const handleSave = async () => {
        const required = ["customer", "order", "delivery"] as const;
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
            const payload: Record<string, any> = {
                client: formValues.customer!,
                ry_number: formValues.order!,
                article: selectedOrder?.article || null,
                model_name: selectedOrder?.model_name || null,
                product: selectedOrder?.product || null,
                shipping_round: parseInt((formValues.delivery || "Lô 1").replace("Lô ", "")) || 1,
                note: formValues.note,
            };

            if (entryType === "received") {
                payload.received_date = entryDate?.format("YYYY-MM-DD") || null;
            } else {
                payload.shipped_date = entryDate?.format("YYYY-MM-DD") || null;
            }

            let total = 0;
            entrySizes.forEach((size) => { 
                const val = parseFloat(sizeValues[size]) || 0;
                payload[sizeToCol(size)] = val;
                total += val;
            });
            
            if (entryType === "received") {
                payload.total_received = total;
            } else {
                payload.total_shipped = total;
            }

            const endpoint = entryType === "received" ? "/api/returns/received" : "/api/returns/shipped";
            await axios.post(endpoint, payload);
            
            setSnackbar({ open: true, message: "Lưu thông tin thành công!", severity: "success" });
            handleReset();
        } catch (error: any) {
            console.error("[API] Error saving return:", error);
            setSnackbar({ 
                open: true, 
                message: "Lỗi khi lưu thông tin.", 
                severity: "error" 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getSharedTextFieldSx = (value: any) => ({
        "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            backgroundColor: !value ? "#e2e8f0" : "#ffffff",
            "& input, & textarea": { color: value ? "#000" : "inherit", fontWeight: value ? "600" : "normal" },
            "& input.Mui-disabled, & textarea.Mui-disabled": {
                WebkitTextFillColor: value ? "#000" : "inherit",
                opacity: 1,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000" },
        },
        "& .MuiInputLabel-root.Mui-focused": { color: "#000" },
    });

    return (
        <Box className="w-full h-[calc(100dvh-80px)] min-h-[calc(100dvh-80px)] overflow-hidden bg-gray-50 p-2 lg:p-4 text-gray-800 flex flex-col">
            <Box className="w-full min-h-0 bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-y-auto no-scrollbar">
                <Box className="flex justify-between items-center mb-5 shrink-0">
                    <h1 className="text-xl font-bold text-black uppercase">
                        {entryType === "received" ? "Nhập Thông Tin Nhận Hàng Sửa" : "Nhập Thông Tin Trả Hàng Sửa"}
                    </h1>
                    <ToggleButtonGroup
                        value={entryType}
                        exclusive
                        onChange={(_, next) => {
                            if (next) {
                                setEntryType(next);
                                handleReset();
                            }
                        }}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 3,
                                py: 1,
                                fontWeight: 700,
                                textTransform: 'none',
                                borderRadius: '10px !important',
                                border: '1px solid #e2e8f0',
                                '&.Mui-selected': {
                                    backgroundColor: '#000',
                                    color: '#fff',
                                    '&:hover': { backgroundColor: '#333' }
                                }
                            }
                        }}
                    >
                        <ToggleButton value="received">Nhận Hàng</ToggleButton>
                        <ToggleButton value="shipped">Trả Hàng</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box component="section" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 4 }}>
                        <Autocomplete
                            options={clientOptions}
                            value={(formValues.customer || null) as any}
                            onChange={(_, newValue) => {
                                updateRequiredField("customer", newValue || "");
                                setFormValues(prev => ({ ...prev, order: "" }));
                            }}
                            onInputChange={(_, newInputValue) => {
                                updateRequiredField("customer", newInputValue);
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={requiredLabel("Khách hàng", "customer")}
                                    variant="outlined"
                                    fullWidth
                                    sx={getSharedTextFieldSx(formValues.customer)}
                                />
                            )}
                        />

                        <DatePicker 
                            label={entryType === "received" ? "Ngày Nhận Hàng" : "Ngày Trả Hàng"} 
                            value={entryDate} 
                            onChange={(v) => setEntryDate(v)} 
                            format="DD/MM/YYYY" 
                            slotProps={{ textField: { fullWidth: true, sx: getSharedTextFieldSx(entryDate) } }} 
                        />

                        <Autocomplete
                            options={orders.map(o => o.ry_number)}
                            value={(formValues.order || null) as any}
                            disabled={!formValues.customer || orders.length === 0}
                            onChange={(_, newValue) => updateRequiredField("order", newValue || "")}
                            onInputChange={(_, newInputValue) => updateRequiredField("order", newInputValue)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={requiredLabel("Lệnh (RY)", "order")}
                                    variant="outlined"
                                    fullWidth
                                    sx={getSharedTextFieldSx(formValues.order)}
                                />
                            )}
                        />
                        
                        <TextField label="Article" variant="outlined" fullWidth value={selectedOrder?.article || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.article)} />
                        <TextField label="Model Name" variant="outlined" fullWidth value={selectedOrder?.model_name || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.model_name)} />
                        <TextField label="Product" variant="outlined" fullWidth value={selectedOrder?.product || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.product)} />
                        <TextField label="CRD" variant="outlined" fullWidth value={selectedOrder?.CRD || ""} disabled sx={getSharedTextFieldSx(selectedOrder?.CRD)} />
                        
                        <Autocomplete
                            options={Array.from({ length: 10 }, (_, i) => `Lô ${i + 1}`)}
                            value={(formValues.delivery || null) as any}
                            disableClearable
                            onChange={(_, newValue) => updateRequiredField("delivery", newValue || "")}
                            slotProps={{ listbox: { style: { maxHeight: 200 } } }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={requiredLabel("Lô hàng", "delivery")}
                                    variant="outlined"
                                    fullWidth
                                    sx={getSharedTextFieldSx(formValues.delivery)}
                                />
                            )}
                        />

                        <TextField
                            label="Ghi chú"
                            multiline
                            rows={1}
                            fullWidth
                            value={formValues.note}
                            onChange={(e) => setFormValues(prev => ({ ...prev, note: e.target.value }))}
                            sx={getSharedTextFieldSx(formValues.note)}
                        />
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
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-sm text-sm">
                        <Save size={16} />
                        {isSaving ? "Đang lưu..." : (entryType === "received" ? "Lưu Phiếu Nhận" : "Lưu Phiếu Trả")}
                    </button>
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
