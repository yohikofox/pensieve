import { FeatureResolutionService } from './feature-resolution.service';
import { Feature } from '../../domain/entities/feature.entity';

const FEATURES: Feature[] = [
  {
    id: 'f1',
    key: 'debug_mode',
    defaultValue: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'f2',
    key: 'data_mining',
    defaultValue: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'f3',
    key: 'news_tab',
    defaultValue: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'f4',
    key: 'projects_tab',
    defaultValue: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'f5',
    key: 'capture_media_buttons',
    defaultValue: false,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

const USER_ID = 'user-123';

function makeService(
  userAssignments: Array<{ featureKey: string; value: boolean }>,
  roleAssignments: Array<{ featureKey: string; value: boolean }>,
  permissionAssignments: Array<{ featureKey: string; value: boolean }>,
): FeatureResolutionService {
  const featureRepo = { findAll: jest.fn().mockResolvedValue(FEATURES) } as any;
  const userRepo = {
    findByUserId: jest.fn().mockResolvedValue(userAssignments),
  } as any;
  const roleRepo = {
    findByUserId: jest.fn().mockResolvedValue(roleAssignments),
  } as any;
  const permissionRepo = {
    findByUserId: jest.fn().mockResolvedValue(permissionAssignments),
  } as any;
  return new FeatureResolutionService(
    featureRepo,
    userRepo,
    roleRepo,
    permissionRepo,
  );
}

describe('FeatureResolutionService.resolveFeatures', () => {
  it('cas 1: aucune assignation → toutes les features false', async () => {
    const service = makeService([], [], []);
    const result = await service.resolveFeatures(USER_ID);

    expect(result['debug_mode']).toBe(false);
    expect(result['data_mining']).toBe(false);
    expect(result['news_tab']).toBe(false);
    expect(result['projects_tab']).toBe(false);
    expect(result['capture_media_buttons']).toBe(false);
  });

  it('cas 2: assignation user seule true → true', async () => {
    const service = makeService(
      [{ featureKey: 'debug_mode', value: true }],
      [],
      [],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['debug_mode']).toBe(true);
    expect(result['data_mining']).toBe(false);
  });

  it('cas 3: assignation user seule false → false', async () => {
    const service = makeService(
      [{ featureKey: 'debug_mode', value: false }],
      [],
      [],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['debug_mode']).toBe(false);
  });

  it('cas 4: assignation role seule true → true', async () => {
    const service = makeService(
      [],
      [{ featureKey: 'news_tab', value: true }],
      [],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['news_tab']).toBe(true);
  });

  it('cas 5: assignation permission seule true → true', async () => {
    const service = makeService(
      [],
      [],
      [{ featureKey: 'data_mining', value: true }],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['data_mining']).toBe(true);
  });

  it('cas 6: conflit user=true + role=false → false (deny-wins)', async () => {
    const service = makeService(
      [{ featureKey: 'debug_mode', value: true }],
      [{ featureKey: 'debug_mode', value: false }],
      [],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['debug_mode']).toBe(false);
  });

  it('cas 7: conflit role=true + permission=false → false (deny-wins)', async () => {
    const service = makeService(
      [],
      [{ featureKey: 'data_mining', value: true }],
      [{ featureKey: 'data_mining', value: false }],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['data_mining']).toBe(false);
  });

  it('cas 8: multiple rôles, un false → false (deny-wins)', async () => {
    const service = makeService(
      [],
      [
        { featureKey: 'news_tab', value: true },
        { featureKey: 'news_tab', value: true },
        { featureKey: 'news_tab', value: false },
      ],
      [],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['news_tab']).toBe(false);
  });

  it('cas 9: toutes sources true → true', async () => {
    const service = makeService(
      [{ featureKey: 'debug_mode', value: true }],
      [{ featureKey: 'debug_mode', value: true }],
      [{ featureKey: 'debug_mode', value: true }],
    );
    const result = await service.resolveFeatures(USER_ID);

    expect(result['debug_mode']).toBe(true);
  });

  it('cas 10: retourne toutes les features du référentiel', async () => {
    const service = makeService([], [], []);
    const result = await service.resolveFeatures(USER_ID);

    expect(Object.keys(result)).toHaveLength(FEATURES.length);
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining([
        'debug_mode',
        'data_mining',
        'news_tab',
        'projects_tab',
        'capture_media_buttons',
      ]),
    );
  });
});
