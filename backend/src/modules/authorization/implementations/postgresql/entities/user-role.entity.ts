import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * UserRole Entity
 * Roles assigned to users
 */
@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('IDX_USER_ROLES_USER_ID')
  userId!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}
