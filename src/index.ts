import { faker } from '@faker-js/faker'
import * as falso from '@ngneat/falso'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Client, QueryResult } from 'pg'
import { PgAnonConfig } from './types.js'
export * from './types.js'

const DEFAULT_CONFIG_FILE_NAME = 'pg-anon.config.js'
const configFileName = process.argv[2] || DEFAULT_CONFIG_FILE_NAME
const configPath = path.resolve(process.cwd(), configFileName)
const config: PgAnonConfig = fs.existsSync(configPath) ? await import(configPath).then(mod => mod.default || mod) : null

if (!config) {
	console.error('Missing configuration in pg-anon.config.js')
	process.exit(1)
}
if (!config.connectionString) {
	console.error('Missing connectionString in pg-anon.config.js')
	process.exit(1)
}
if (!Array.isArray(config.tables)) {
	console.error('Missing tables array in pg-anon.config.js')
	process.exit(1)
}

const DEFAULT_BATCH = 100

async function anonymize() {
	const client = new Client({
		connectionString: config.connectionString,
		ssl: {
			rejectUnauthorized: false,
		},
	})
	await client.connect()

	const start = Date.now()

	for (const table of config.tables) {
		const { name, idColumn, columns } = table

		let previousId: unknown | undefined = table.afterId

		const batch = table.batch !== undefined ? table.batch : config.batch !== undefined ? config.batch : DEFAULT_BATCH
		let countBatches = 0
		let count = 0

		while (true) {
			await client.query('BEGIN')

			let res: QueryResult
			if (previousId !== undefined) {
				if (batch > 0) {
					res = await client.query(`SELECT ${idColumn} FROM ${name} WHERE ${idColumn} > $1 ORDER BY ${idColumn} LIMIT $2`, [previousId, batch])
				} else {
					res = await client.query(`SELECT ${idColumn} FROM ${name} WHERE ${idColumn} > $1 ORDER BY ${idColumn}`, [previousId])
				}
			} else if (batch > 0) {
				res = await client.query(`SELECT ${idColumn} FROM ${name} ORDER BY ${idColumn} LIMIT $1`, [batch])
			} else {
				res = await client.query(`SELECT ${idColumn} FROM ${name} ORDER BY ${idColumn}`)
			}

			if (!res.rows.length) {
				await client.query('COMMIT')
				break
			}

			countBatches += 1

			if (previousId !== undefined) {
				console.log(`* Batch ${countBatches} with ${res.rows.length} rows in table '${name}' after ${idColumn}: ${previousId}`)
			} else {
				console.log(`* Batch ${countBatches} with ${res.rows.length} rows in table '${name}'`)
			}

			for (const row of res.rows) {
				const id = row[idColumn]
				previousId = id
					
				const sets = []
				const values = []
				let i = 1

				for (const [col, colConfig] of Object.entries(columns)) {
					const seed = `${id}-${col}`
					let value: unknown

					if (typeof colConfig === 'object') {
						if (colConfig.faker) {
							faker.seed(hashToSeed(seed))
							if (typeof colConfig.faker === 'string') {
								value = resolveFunction(faker, colConfig.faker)()
							} else {
								value = colConfig.faker(faker)
							}
						} else if (colConfig.falso) {
							falso.seed(seed)
							if (typeof colConfig.falso === 'string') {
								value = resolveFunction(falso, colConfig.falso)()
							} else {
								value = colConfig.falso(falso)
							}
						} else {
							throw new Error(`Column config has neither faker nor falso: ${name}.${col}`)
						}
					} else if (typeof colConfig === 'function') {
						value = colConfig(hashToSeed(seed))
					} else {
						throw new Error(`Column config is invalid: ${name}.${col}`)
					}
					
					sets.push(`${col} = $${i}`)
					values.push(value)
					i++
				}

				values.push(id)
				const updateQuery = `UPDATE ${name} SET ${sets.join(', ')} WHERE ${idColumn} = $${i}`
				await client.query(updateQuery, values)
				// console.log(updateQuery, values)

				count++
			}

			await client.query('COMMIT')
		}

		console.log(`* Updated ${count} rows in table '${name}' in ${countBatches} batches in ${(Date.now() - start) / 1000}s. Finished.`)
	}

	await client.end()
}

function hashToSeed(str: string) {
	return parseInt(crypto.createHash('md5').update(str).digest('hex').slice(0, 8), 16)
}

function resolveFunction(source: object, path: string) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return path.split('.').reduce((acc: any, key) => acc?.[key], source)
}

anonymize().catch(err => {
	console.error('Error during anonymization:', err)
	process.exit(1)
})
