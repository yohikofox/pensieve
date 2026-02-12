import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type AuditAction =
  | 'RGPD_EXPORT_REQUESTED'
  | 'RGPD_ACCOUNT_DELETED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 100 })
  action!: AuditAction;

  @CreateDateColumn({ type: 'timestamp' })
  timestamp!: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any> | null;

  @ManyToOne(() => User, (user) => user.audit_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
