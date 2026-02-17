import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * CaptureType — Table référentielle
 * Valeurs: 'audio', 'text'
 */
@Entity('capture_types')
export class CaptureType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  name!: string;
}
