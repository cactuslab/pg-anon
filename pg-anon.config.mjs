/**
 * @type {import('pg-anon').PgAnonConfig}
 */
const config = {
	connectionString: 'postgres://user:password@host:port/database',
	tables: [
		{
			name: 'table1',
			idColumn: 'id',
			// afterId: 999,
			// batch: 1000,
			columns: {
				name: {
					faker: 'person.fullName',
				},
				full_address: {
					faker: (faker) => `${faker.location.streetAddress()}, ${faker.location.county()}, ${faker.location.city()}`,
				},
				email: {
					falso: 'randEmail',
				},
				age: () => Math.round(16 + Math.random(80)),
			}
		},
	],
}

export default config
