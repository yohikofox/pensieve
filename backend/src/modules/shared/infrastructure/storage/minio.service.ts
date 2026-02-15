import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT');
    const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'));
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');

    if (!endpoint || !accessKey || !secretKey) {
      throw new Error(
        'Missing MinIO configuration: MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY must be set',
      );
    }

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    this.bucket = 'pensine-audios';
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        console.log(`MinIO bucket "${this.bucket}" created successfully`);
      }
    } catch (error) {
      console.error('Error ensuring MinIO bucket exists:', error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for uploading an object
   * @param objectName The name/path of the object in the bucket
   * @param expiry Expiration time in seconds (default: 3600 = 1 hour)
   */
  async presignedPutObject(
    objectName: string,
    expiry: number = 3600,
  ): Promise<string> {
    try {
      return await this.client.presignedPutObject(
        this.bucket,
        objectName,
        expiry,
      );
    } catch (error) {
      console.error('Error generating presigned PUT URL:', error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for downloading an object
   * @param objectName The name/path of the object in the bucket
   * @param expiry Expiration time in seconds (default: 86400 = 24 hours)
   */
  async presignedGetObject(
    objectName: string,
    expiry: number = 86400,
  ): Promise<string> {
    try {
      return await this.client.presignedGetObject(
        this.bucket,
        objectName,
        expiry,
      );
    } catch (error) {
      console.error('Error generating presigned GET URL:', error);
      throw error;
    }
  }

  /**
   * Delete an object from the bucket
   * @param objectName The name/path of the object to delete
   */
  async removeObject(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (error) {
      console.error('Error removing object:', error);
      throw error;
    }
  }

  /**
   * Check if an object exists in the bucket
   * @param objectName The name/path of the object to check
   */
  async objectExists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Upload object directly from buffer
   *
   * Story 6.2 - Task 7.3: Direct upload support
   *
   * @param objectName The name/path of the object in the bucket
   * @param buffer File buffer to upload
   * @param contentType MIME type of the file
   * @returns The object name/path
   */
  async putObject(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        {
          'Content-Type': contentType,
        },
      );
      return objectName;
    } catch (error) {
      console.error('Error uploading object:', error);
      throw error;
    }
  }
}
