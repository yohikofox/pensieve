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
import { Permission } from './permission.entity';

/**
 * UserPermission Entity
 * Direct user permission overrides (grant or deny)
 */
@Entity('user_permissions')
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index('IDX_USER_PERMISSIONS_USER_ID')
  userId!: string;

  @Column('uuid')
  permissionId!: string;

  @Column('boolean')
  granted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Permission, (permission) => permission.userPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;
}
