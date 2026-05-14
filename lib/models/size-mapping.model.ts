import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export interface SizeMapping {
  id?: number;
  client_name: string;
  client_size: string;
  standard_size: string;
}

export class SizeMappingModel {
  /**
   * Đảm bảo bảng tồn tại trong database
   */
  static async ensureTableExists() {
    const query = `
      CREATE TABLE IF NOT EXISTS size_mappings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_name VARCHAR(255) NOT NULL,
        client_size VARCHAR(50) NOT NULL,
        standard_size VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY client_size_unique (client_name, client_size)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.query(query);
  }

  static async getAllByClient(clientName: string) {
    await this.ensureTableExists();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM size_mappings WHERE client_name = ? ORDER BY client_size ASC",
      [clientName]
    );
    return rows as SizeMapping[];
  }

  static async upsert(mapping: SizeMapping) {
    await this.ensureTableExists();
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO size_mappings (client_name, client_size, standard_size) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE standard_size = VALUES(standard_size)`,
      [mapping.client_name, mapping.client_size, mapping.standard_size]
    );
    return result;
  }

  static async delete(id: number) {
    await db.query("DELETE FROM size_mappings WHERE id = ?", [id]);
    return true;
  }
}
