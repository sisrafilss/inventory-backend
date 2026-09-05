import { prisma } from "../../config/db.js";

export class SettingsService {
  static async getStoreSetting() {
    let setting = await prisma.storeSetting.findFirst();
    if (!setting) {
      setting = await prisma.storeSetting.create({
        data: {
          storeName: "M.R. Enterprise",
          proprietor: "M.R. Proprietor",
          phone: "+880 1700-000000",
          address: "Dhaka, Bangladesh",
          memoFooterNote: "Thank you for your business! Please visit again.",
        },
      });
    }
    return setting;
  }

  static async updateStoreSetting(data: {
    storeName?: string;
    proprietor?: string;
    phone?: string | null;
    address?: string | null;
    memoFooterNote?: string | null;
  }) {
    const existing = await this.getStoreSetting();

    return prisma.storeSetting.update({
      where: { id: existing.id },
      data: {
        ...(data.storeName && { storeName: data.storeName.trim() }),
        ...(data.proprietor && { proprietor: data.proprietor.trim() }),
        ...(data.phone !== undefined && { phone: data.phone ? data.phone.trim() : null }),
        ...(data.address !== undefined && { address: data.address ? data.address.trim() : null }),
        ...(data.memoFooterNote !== undefined && {
          memoFooterNote: data.memoFooterNote ? data.memoFooterNote.trim() : null,
        }),
      },
    });
  }
}
