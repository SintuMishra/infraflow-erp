const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_NAME = process.env.DB_NAME || "construction_erp_db";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";

const withMockedModules = async (serviceRelativePath, mockEntries, run) => {
  const servicePath = require.resolve(serviceRelativePath);
  const originalService = require.cache[servicePath];
  const originals = new Map();

  for (const [dependencyRelativePath, mockExports] of mockEntries) {
    const dependencyPath = require.resolve(dependencyRelativePath);
    originals.set(dependencyPath, require.cache[dependencyPath]);
    require.cache[dependencyPath] = {
      id: dependencyPath,
      filename: dependencyPath,
      loaded: true,
      exports: mockExports,
    };
  }

  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await run(service);
  } finally {
    delete require.cache[servicePath];

    if (originalService) {
      require.cache[servicePath] = originalService;
    }

    for (const [dependencyPath, originalModule] of originals.entries()) {
      if (originalModule) {
        require.cache[dependencyPath] = originalModule;
      } else {
        delete require.cache[dependencyPath];
      }
    }
  }
};

test("createEmployeeRecord retries when employee_code hits a unique conflict", async () => {
  let lastCodeCalls = 0;
  let insertCalls = 0;

  await withMockedModules(
    "../src/modules/employees/employees.service.js",
    [
      [
        "../src/modules/employees/employees.model",
        {
          findAllEmployees: async () => [],
          findLastEmployeeCodeByPrefix: async () => {
            lastCodeCalls += 1;
            return lastCodeCalls === 1 ? "EMP0007" : "EMP0008";
          },
          insertEmployee: async (payload) => {
            insertCalls += 1;

            if (insertCalls === 1) {
              const error = new Error("duplicate employee code");
              error.code = "23505";
              error.constraint = "employees_employee_code_key";
              throw error;
            }

            return {
              id: 21,
              employeeCode: payload.employeeCode,
              fullName: payload.fullName,
            };
          },
          updateEmployeeStatus: async () => null,
          updateEmployeeById: async () => null,
          setUserActiveStatusByEmployeeId: async () => null,
        },
      ],
      [
        "../src/utils/employeeCode.util",
        {
          getDepartmentPrefix: () => "EMP",
          buildNextEmployeeCode: (prefix, lastCode) => {
            const numberPart = Number(String(lastCode).slice(prefix.length) || "0");
            return `${prefix}${String(numberPart + 1).padStart(4, "0")}`;
          },
        },
      ],
    ],
    async ({ createEmployeeRecord }) => {
      const employee = await createEmployeeRecord({
        fullName: "Amit Sharma",
        mobileNumber: "9999999999",
        department: "Admin",
        designation: "Managing Director",
        joiningDate: "2026-04-17",
        companyId: 41,
      });

      assert.equal(insertCalls, 2);
      assert.equal(employee.employeeCode, "EMP0009");
    }
  );
});

test("createEmployeeRecord uses savepoints so retries work inside a transaction client", async () => {
  const transactionQueries = [];
  let insertCalls = 0;

  await withMockedModules(
    "../src/modules/employees/employees.service.js",
    [
      [
        "../src/modules/employees/employees.model",
        {
          findAllEmployees: async () => [],
          findLastEmployeeCodeByPrefix: async () =>
            insertCalls === 0 ? "EMP0010" : "EMP0011",
          insertEmployee: async (payload) => {
            insertCalls += 1;

            if (insertCalls === 1) {
              const error = new Error("duplicate employee code");
              error.code = "23505";
              error.constraint = "employees_employee_code_key";
              throw error;
            }

            return {
              id: 31,
              employeeCode: payload.employeeCode,
              fullName: payload.fullName,
            };
          },
          updateEmployeeStatus: async () => null,
          updateEmployeeById: async () => null,
          setUserActiveStatusByEmployeeId: async () => null,
        },
      ],
      [
        "../src/utils/employeeCode.util",
        {
          getDepartmentPrefix: () => "EMP",
          buildNextEmployeeCode: (prefix, lastCode) => {
            const numberPart = Number(String(lastCode).slice(prefix.length) || "0");
            return `${prefix}${String(numberPart + 1).padStart(4, "0")}`;
          },
        },
      ],
    ],
    async ({ createEmployeeRecord }) => {
      const fakeTransaction = {
        query: async (sql) => {
          transactionQueries.push(sql);
          return { rows: [] };
        },
      };

      const employee = await createEmployeeRecord(
        {
          fullName: "Amit Sharma",
          mobileNumber: "9999999999",
          department: "Admin",
          designation: "Managing Director",
          joiningDate: "2026-04-17",
          companyId: 41,
        },
        fakeTransaction
      );

      assert.equal(employee.employeeCode, "EMP0012");
      assert.ok(
        transactionQueries.some((sql) => /SAVEPOINT employee_code_retry_1/i.test(sql))
      );
      assert.ok(
        transactionQueries.some((sql) =>
          /ROLLBACK TO SAVEPOINT employee_code_retry_1/i.test(sql)
        )
      );
      assert.ok(
        transactionQueries.some((sql) =>
          /RELEASE SAVEPOINT employee_code_retry_2/i.test(sql)
        )
      );
    }
  );
});

test("createEmployeeRecord normalizes optional create profile fields", async () => {
  let capturedInsertPayload = null;

  await withMockedModules(
    "../src/modules/employees/employees.service.js",
    [
      [
        "../src/modules/employees/employees.model",
        {
          findAllEmployees: async () => [],
          findLastEmployeeCodeByPrefix: async () => null,
          insertEmployee: async (payload) => {
            capturedInsertPayload = payload;
            return {
              id: 41,
              employeeCode: payload.employeeCode,
              fullName: payload.fullName,
              status: payload.status,
              remarks: payload.remarks,
            };
          },
          updateEmployeeStatus: async () => null,
          updateEmployeeById: async () => null,
          setUserActiveStatusByEmployeeId: async () => null,
        },
      ],
      [
        "../src/utils/employeeCode.util",
        {
          getDepartmentPrefix: () => "EMP",
          buildNextEmployeeCode: () => "EMP0001",
        },
      ],
    ],
    async ({ createEmployeeRecord }) => {
      await createEmployeeRecord({
        fullName: "Sonal Verma",
        mobileNumber: "9000011111",
        email: "  sonal.verma@example.com ",
        emergencyContactNumber: " 9012345678 ",
        address: "  Mohda Crusher Camp ",
        employmentType: " Full_Time ",
        idProofType: " Aadhaar ",
        idProofNumber: " 1234-5678-9012 ",
        department: "",
        designation: "",
        status: "",
        remarks: "  Joined for seasonal plant ops  ",
        companyId: 41,
      });
    }
  );

  assert.equal(capturedInsertPayload.department, "General");
  assert.equal(capturedInsertPayload.designation, "Team Member");
  assert.equal(capturedInsertPayload.email, "sonal.verma@example.com");
  assert.equal(capturedInsertPayload.emergencyContactNumber, "9012345678");
  assert.equal(capturedInsertPayload.address, "Mohda Crusher Camp");
  assert.equal(capturedInsertPayload.employmentType, "full_time");
  assert.equal(capturedInsertPayload.idProofType, "aadhaar");
  assert.equal(capturedInsertPayload.idProofNumber, "1234-5678-9012");
  assert.equal(capturedInsertPayload.status, "active");
  assert.equal(
    capturedInsertPayload.remarks,
    "Joined for seasonal plant ops"
  );
});

test("editEmployeeRecord updates editable fields and keeps login status in sync", async () => {
  let capturedUpdatePayload = null;
  let capturedLoginPayload = null;

  await withMockedModules(
    "../src/modules/employees/employees.service.js",
    [
      [
        "../src/modules/employees/employees.model",
        {
          findAllEmployees: async () => [],
          findLastEmployeeCodeByPrefix: async () => null,
          insertEmployee: async () => null,
          updateEmployeeStatus: async () => null,
          updateEmployeeById: async (payload) => {
            capturedUpdatePayload = payload;
            return {
              id: payload.employeeId,
              employeeCode: "EMP0101",
              fullName: payload.fullName,
              mobileNumber: payload.mobileNumber,
              department: payload.department,
              designation: payload.designation,
              joiningDate: payload.joiningDate,
              status: payload.status,
              relievingDate: payload.relievingDate,
              remarks: payload.remarks,
            };
          },
          setUserActiveStatusByEmployeeId: async (employeeId, isActive) => {
            capturedLoginPayload = { employeeId, isActive };
            return { employeeId, isActive };
          },
        },
      ],
      [
        "../src/utils/employeeCode.util",
        {
          getDepartmentPrefix: () => "EMP",
          buildNextEmployeeCode: () => "EMP0001",
        },
      ],
    ],
    async ({ editEmployeeRecord }) => {
      const updated = await editEmployeeRecord({
        employeeId: "17",
        fullName: "  Ravi Kumar  ",
        mobileNumber: " 9876543210 ",
        email: " RAVI@EXAMPLE.COM ",
        emergencyContactNumber: " 9123456789 ",
        address: "  Worker Colony A  ",
        employmentType: " Contract ",
        idProofType: " Pan ",
        idProofNumber: " ABCTY1234Z ",
        department: " Plant Operations ",
        designation: " Senior Supervisor ",
        joiningDate: "2026-04-17",
        status: " inactive ",
        relievingDate: "2026-05-01",
        remarks: " Shift moved ",
        companyId: 44,
      });

      assert.equal(updated.id, 17);
    }
  );

  assert.equal(capturedUpdatePayload.employeeId, 17);
  assert.equal(capturedUpdatePayload.fullName, "Ravi Kumar");
  assert.equal(capturedUpdatePayload.mobileNumber, "9876543210");
  assert.equal(capturedUpdatePayload.email, "ravi@example.com");
  assert.equal(capturedUpdatePayload.emergencyContactNumber, "9123456789");
  assert.equal(capturedUpdatePayload.address, "Worker Colony A");
  assert.equal(capturedUpdatePayload.employmentType, "contract");
  assert.equal(capturedUpdatePayload.idProofType, "pan");
  assert.equal(capturedUpdatePayload.idProofNumber, "ABCTY1234Z");
  assert.equal(capturedUpdatePayload.department, "Plant Operations");
  assert.equal(capturedUpdatePayload.designation, "Senior Supervisor");
  assert.equal(capturedUpdatePayload.status, "inactive");
  assert.equal(capturedLoginPayload.employeeId, 17);
  assert.equal(capturedLoginPayload.isActive, false);
});

test("editEmployeeRecord applies practical defaults for optional fields", async () => {
  let capturedUpdatePayload = null;

  await withMockedModules(
    "../src/modules/employees/employees.service.js",
    [
      [
        "../src/modules/employees/employees.model",
        {
          findAllEmployees: async () => [],
          findLastEmployeeCodeByPrefix: async () => null,
          insertEmployee: async () => null,
          updateEmployeeStatus: async () => null,
          updateEmployeeById: async (payload) => {
            capturedUpdatePayload = payload;
            return {
              id: payload.employeeId,
              employeeCode: "EMP0102",
              fullName: payload.fullName,
              mobileNumber: payload.mobileNumber,
              department: payload.department,
              designation: payload.designation,
              status: payload.status,
            };
          },
          setUserActiveStatusByEmployeeId: async () => ({ employeeId: 18 }),
        },
      ],
      [
        "../src/utils/employeeCode.util",
        {
          getDepartmentPrefix: () => "EMP",
          buildNextEmployeeCode: () => "EMP0001",
        },
      ],
    ],
    async ({ editEmployeeRecord }) => {
      await editEmployeeRecord({
        employeeId: 18,
        fullName: "Priya Singh",
        mobileNumber: "9123456789",
        department: "",
        designation: "",
        status: "",
      });
    }
  );

  assert.equal(capturedUpdatePayload.department, "General");
  assert.equal(capturedUpdatePayload.designation, "Team Member");
  assert.equal(capturedUpdatePayload.status, "active");
});
