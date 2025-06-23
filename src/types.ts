import type { Faker } from '@faker-js/faker'
import type * as falso from '@ngneat/falso'

type KeyPaths<T, Prev extends string = ''> = {
	[K in keyof T]: T[K] extends object
		? T[K] extends Array<unknown>
			? `${Prev}${K & string}` // exclude array recursion
			: `${Prev}${K & string}` | `${Prev}${K & string}.${KeyPaths<T[K]>}`
		: `${Prev}${K & string}`;
}[keyof T]

/**
 * The type of the config file export.
 */
export interface PgAnonConfig {
	connectionString: string
	batch?: number
	tables: Table[]
}

/**
 * The configuration for a database table.
 */
export interface Table {
	/** The name of the table */
	name: string
	/** The name of the ID column in the table. Tables must have a single ID column. */
	idColumn: string
	/** The ID value to resume from. Use to recover a long run. */
	afterId?: unknown
	/** How many rows to do in a transaction batch. Set to 0 to do it all in one. Default is 100. */
	batch?: number
	/** The columns to change. The column name is the key; the value is how to replace the column value. */
	columns: Record<string, ColumnConfig>
}

/**
 * The configuration for replacing a column value.
 * Supports faker or falso, as either a keypath string into either object, or a function that receives faker or falso as its first argument.
 * Alternatively, simply a function that receives a seed number (to allow stable random generation) as its first argument.
 */
export type ColumnConfig = {
	faker: KeyPaths<Faker> | ((fakerObject: Faker) => unknown)
	falso?: never
} | {
	falso: KeyPaths<typeof falso> | ((falsoObject: typeof falso) => unknown)
	faker?: never
} | {
	faker?: never
	falso?: never
} | ((seed: number) => unknown)
