import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * CaptureState — Table référentielle
 * Valeurs: 'recording', 'captured', 'failed'
 */
@Entity('capture_states')
export class CaptureState {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  name!: string;
}
