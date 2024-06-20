import { HistoryEntry, MigrationSequence, SerializedStore, StoreSchema } from '@tldraw/store'
import {
	SchemaPropsInfo,
	TLAssetStore,
	TLRecord,
	TLStore,
	TLStoreProps,
	createTLSchema,
} from '@tldraw/tlschema'
import { FileHelpers } from '@tldraw/utils'
import { TLAnyBindingUtilConstructor, checkBindings } from './defaultBindings'
import { TLAnyShapeUtilConstructor, checkShapesAndAddCore } from './defaultShapes'

/** @public */
export type TLStoreOptions = {
	initialData?: SerializedStore<TLRecord>
	defaultName?: string
	id?: string
	assets?: Partial<TLAssetStore>
} & (
	| {
			shapeUtils?: readonly TLAnyShapeUtilConstructor[]
			migrations?: readonly MigrationSequence[]
			bindingUtils?: readonly TLAnyBindingUtilConstructor[]
	  }
	| { schema?: StoreSchema<TLRecord, TLStoreProps> }
)

/** @public */
export type TLStoreEventInfo = HistoryEntry<TLRecord>

/** @public */
export const defaultAssetManager: TLAssetStore = {
	upload: (_, file) => FileHelpers.blobToDataUrl(file),
	resolve: (asset) => asset.props.src,
}

/**
 * A helper for creating a TLStore.
 *
 * @param opts - Options for creating the store.
 *
 * @public */
export function createTLStore({
	initialData,
	defaultName = '',
	id,
	assets,
	...rest
}: TLStoreOptions = {}): TLStore {
	const schema =
		'schema' in rest && rest.schema
			? // we have a schema
				rest.schema
			: // we need a schema
				createTLSchema({
					shapes:
						'shapeUtils' in rest && rest.shapeUtils
							? utilsToMap(checkShapesAndAddCore(rest.shapeUtils))
							: undefined,
					bindings:
						'bindingUtils' in rest && rest.bindingUtils
							? utilsToMap(checkBindings(rest.bindingUtils))
							: undefined,
					migrations: 'migrations' in rest ? rest.migrations : undefined,
				})

	return new TLStore({
		id,
		schema,
		initialData,
		props: {
			defaultName,
			assets: {
				...defaultAssetManager,
				...assets,
			},
		},
	})
}

function utilsToMap<T extends SchemaPropsInfo & { type: string }>(utils: T[]) {
	return Object.fromEntries(
		utils.map((s): [string, SchemaPropsInfo] => [
			s.type,
			{
				props: s.props,
				migrations: s.migrations,
			},
		])
	)
}
