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
  id!: string; // Better Auth user ID

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: 'active' | 'deletion_pending' | 'deleted';

  @Column({ type: 'timestamptz', nullable: true })
  deletion_requested_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
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

  // Story 7.1: Support Mode avec Permissions Backend
  @Column({ type: 'boolean', default: false })
  debug_mode_access!: boolean;

  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  audit_logs!: AuditLog[];
}
