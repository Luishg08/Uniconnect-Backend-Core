/**
 * Shared Prisma mock factory for unit tests
 * US-T01/US-T02: Eliminates boilerplate duplication across spec files
 */

type MockFn = jest.Mock;

interface ModelMock {
  findUnique: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
  upsert: MockFn;
}

export interface PrismaMock {
  notification: ModelMock;
  group: ModelMock;
  membership: ModelMock;
  user: ModelMock;
  message: ModelMock;
  connection: ModelMock;
  group_invitation: ModelMock;
  group_join_request: ModelMock;
  course: ModelMock;
  enrollment: ModelMock;
  $transaction: MockFn;
}

function createModelMock(): ModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  };
}

export function createPrismaMock(): PrismaMock {
  return {
    notification: createModelMock(),
    group: createModelMock(),
    membership: createModelMock(),
    user: createModelMock(),
    message: createModelMock(),
    connection: createModelMock(),
    group_invitation: createModelMock(),
    group_join_request: createModelMock(),
    course: createModelMock(),
    enrollment: createModelMock(),
    $transaction: jest.fn(),
  };
}
