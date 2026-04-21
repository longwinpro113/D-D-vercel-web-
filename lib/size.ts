export const sizes = Array.from({ length: 31 }, (_, index) => 3 + index * 0.5);
export const entrySizes = [1, 2, ...sizes];
export const sizeColumns = entrySizes.map((size) => `s${String(size).replace(".", "_")}`);
export const sizeToCol = (size: number | string) => `s${String(size).replace(".", "_")}`;
