import db from '@/lib/db';
import { chats, users } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface RecordedFile {
  id: string;
  userId: string | null;
  name: string;
  filePath: string;
  contentPath: string;
  uploadedAt: string;
}

/**
 * Migrates legacy data (chats and files with null userId) to the first admin user.
 * This ensures that all legacy data is assigned to a user and prevents
 * any user from accessing orphaned data.
 *
 * Run this migration once after upgrading to multi-user support.
 */
export async function migrateLegacyData(): Promise<{
  chatsUpdated: number;
  filesUpdated: number;
  adminId: string | null;
}> {
  const result = { chatsUpdated: 0, filesUpdated: 0, adminId: null as string | null };

  try {
    // Find the first admin user
    const admin = await db.query.users.findFirst({
      where: eq(users.role, 'admin'),
      orderBy: users.createdAt,
    });

    if (!admin) {
      console.warn('[Migration] No admin user found. Skipping legacy data migration.');
      return result;
    }

    result.adminId = admin.id;
    console.log(`[Migration] Assigning legacy data to admin: ${admin.email}`);

    // Migrate chats with null userId
    const orphanedChats = await db
      .select({ id: chats.id })
      .from(chats)
      .where(isNull(chats.userId));

    if (orphanedChats.length > 0) {
      await db
        .update(chats)
        .set({ userId: admin.id })
        .where(isNull(chats.userId));

      result.chatsUpdated = orphanedChats.length;
      console.log(`[Migration] Updated ${orphanedChats.length} orphaned chats`);
    }

    // Migrate files with null userId
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    const uploadedFilesPath = path.join(uploadsDir, 'uploaded_files.json');

    if (fs.existsSync(uploadedFilesPath)) {
      const data = JSON.parse(fs.readFileSync(uploadedFilesPath, 'utf-8'));
      const files: RecordedFile[] = data.files || [];

      let filesUpdated = 0;
      const updatedFiles = files.map((file) => {
        if (file.userId === null) {
          filesUpdated++;
          return { ...file, userId: admin.id };
        }
        return file;
      });

      if (filesUpdated > 0) {
        fs.writeFileSync(
          uploadedFilesPath,
          JSON.stringify({ files: updatedFiles }, null, 2),
        );
        result.filesUpdated = filesUpdated;
        console.log(`[Migration] Updated ${filesUpdated} orphaned files`);
      }
    }

    console.log('[Migration] Legacy data migration complete');
    return result;
  } catch (error) {
    console.error('[Migration] Error during legacy data migration:', error);
    throw error;
  }
}

/**
 * Check if there is any legacy data that needs migration.
 */
export async function hasLegacyData(): Promise<boolean> {
  try {
    // Check for orphaned chats
    const orphanedChats = await db
      .select({ id: chats.id })
      .from(chats)
      .where(isNull(chats.userId))
      .limit(1);

    if (orphanedChats.length > 0) {
      return true;
    }

    // Check for orphaned files
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    const uploadedFilesPath = path.join(uploadsDir, 'uploaded_files.json');

    if (fs.existsSync(uploadedFilesPath)) {
      const data = JSON.parse(fs.readFileSync(uploadedFilesPath, 'utf-8'));
      const files: RecordedFile[] = data.files || [];
      const orphanedFiles = files.filter((f) => f.userId === null);
      if (orphanedFiles.length > 0) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
