import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id!: string; // Supabase user ID

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: 'active' | 'deletion_pending' | 'deleted';

  @Column({ type: 'timestamp', nullable: true })
  deletion_requested_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;

  // Notification preferences (Story 4.4 - AC7)
  @Column({ type: 'varchar', length: 255, nullable: true })
  pushToken?: string | null;

  @Column({ type: 'boolean', default: true })
  pushNotificationsEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  localNotificationsEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  hapticFeedbackEnabled!: boolean;

  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  audit_logs!: AuditLog[];
}
