import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { CloudinaryResponse } from './cloudinary-response';

@Injectable()
export class UploadService {
    uploadFile(file: Express.Multer.File, folder: string): Promise<CloudinaryResponse> {
        return new Promise<CloudinaryResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result as CloudinaryResponse);
                },
            );

            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }

    async deleteFile(publicId: string, folder: string): Promise<void> {
        try {
            return new Promise((resolve, reject) => {
                cloudinary.uploader.destroy(`${folder}/${publicId}`, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });
        } catch (error) {
            throw error;
        }
    }
    async uploadFilesAtomic(
        files: Express.Multer.File[],
        folder: string,
    ): Promise<CloudinaryResponse[]> {
        const uploaded: CloudinaryResponse[] = [];
        try {
            for (const file of files) {
                const res = await this.uploadFile(file, folder);
                uploaded.push(res);
            }
            return uploaded;
        } catch (err) {
            await Promise.allSettled(
                uploaded.map((r) => {
                    const id =
                        r.public_id?.startsWith(`${folder}/`)
                            ? r.public_id.slice(folder.length + 1)
                            : r.public_id;
                    return this.deleteFile(id, folder);
                }),
            );
            throw err;
        }
    }
}
