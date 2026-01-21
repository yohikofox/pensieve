import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id!: string;  // Supabase user ID

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

  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  audit_logs!: AuditLog[];
}
