export const sizes = [1, 2, 2.5, ...Array.from({ length: 31 }, (_, index) => 3 + index * 0.5)];
export const entrySizes = sizes;
export const sizeColumns = entrySizes.map((size) => `s${String(size).replace(".", "_")}`);
export const sizeToCol = (size: number | string) => `s${String(size).replace(".", "_")}`;
