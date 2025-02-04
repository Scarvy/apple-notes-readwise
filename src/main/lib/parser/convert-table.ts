import { AppleNotesExtractor } from './apple-notes';
import { NoteConverter } from './convert-note';
import {
	ANConverter,
	ANMergableDataProto,
	ANMergeableDataObject,
	ANTableKey,
	ANTableObject,
	ANTableType,
	ANTableUuidMapping,
} from '@shared/models';

// Source: https://github.com/obsidianmd/obsidian-importer/blob/master/src/formats/apple-notes/convert-table.ts
export class TableConverter extends ANConverter {
	table: ANMergeableDataObject;

	// Apple Notes uses CRDTs to allow multiple people to work on a note at once.
	// Therefore, everything is stored as references with heaps of indirection instead of directly

	// These are used as keys for objects to reference another, by offset in these lists
	// e.g. a type is stored as 9 which means whatever's in types[9]
	keys: ANTableKey[];
	types: ANTableType[];
	uuids: string[];

	// This is used to store the actual data
	objects: ANTableObject[];

	rowCount = 0;
	rowLocations: ANTableUuidMapping = {};

	columnCount = 0;
	columnLocations: ANTableUuidMapping = {};

	static protobufType = 'ciofecaforensics.MergableDataProto';

	constructor(importer: AppleNotesExtractor, table: ANMergableDataProto) {
		super(importer);
		this.table = table.mergableDataObject;

		const data = this.table.mergeableDataObjectData;

		this.keys = data.mergeableDataObjectKeyItem;
		this.types = data.mergeableDataObjectTypeItem;
		this.uuids = data.mergeableDataObjectUuidItem.map(this.uuidToString);
		this.objects = data.mergeableDataObjectEntry;
	}

	async parse(): Promise<string[][] | null> {
		// We want to find the root table object first
		const root = this.objects.find(e => e.customMap && this.types[e.customMap.type] == ANTableType.ICTable);
		if (!root) return null;

		let cellData: ANTableObject | null = null;

		// The root contains references which lead to the row locations, column locations, or actual cell data
		for (const entry of root.customMap.mapEntry) {
			const object = this.objects[entry.value.objectIndex];

			switch (this.keys[entry.key]) {
				case ANTableKey.Rows:
					[this.rowLocations, this.rowCount] = this.findLocations(object);
					break;

				case ANTableKey.Columns:
					[this.columnLocations, this.columnCount] = this.findLocations(object);
					break;

				case ANTableKey.CellColumns:
					cellData = object;
					break;
			}
		}

		if (!cellData) return null;
		return await this.computeCells(cellData);
	}

	/** Compute the location of the rows/columns, 
	returning a mapping of the row/col uuid to its location in the table, and the total row/col amount */
	findLocations(object: ANTableObject): [ANTableUuidMapping, number] {
		const ordering: string[] = [];
		const indices: ANTableUuidMapping = {};

		for (const element of object.orderedSet.ordering.array.attachment) {
			ordering.push(this.uuidToString(element.uuid));
		}

		for (const element of object.orderedSet.ordering.contents.element) {
			const key = this.getTargetUuid(element.key);
			const value = this.getTargetUuid(element.value);

			indices[value] = ordering.indexOf(key);
		}

		return [indices, ordering.length];
	}

	/** Use the computed indices to build a table array and format each cell */
	async computeCells(cellData: ANTableObject): Promise<string[][]> {
		// Fill the array to the table dimensions
		const result = Array(this.rowCount).fill(0).map(() => Array(this.columnCount));

		// Put the values in the table	
		for (const column of cellData.dictionary.element) {
			const columnLocation = this.columnLocations[this.getTargetUuid(column.key)];
			const rowData = this.objects[column.value.objectIndex];

			for (const row of rowData.dictionary.element) {
				const rowLocation = this.rowLocations[this.getTargetUuid(row.key)];
				const rowContent = this.objects[row.value.objectIndex];

				if (!(rowLocation in result) || !rowContent) continue;

				const converter = new NoteConverter(this.importer, rowContent);
				result[rowLocation][columnLocation] = await converter.format(true);
			}
		}

		return result;
	}

	/** Convert the table array into a markdown table */
	async format(): Promise<string> {
		const table = await this.parse();
		if (!table) return '';

		let converted = '\n';

		for (let i = 0; i < table.length; i++) {
			converted += `| ${table[i].join(' | ')} |\n`;
			if (i == 0) converted += `|${' -- |'.repeat(table[0].length)}\n`;
		}

		return converted + '\n';
	}

	/** Get the index in this.uuids from an table object (which references another object which in turn has the UUID indice) */
	getTargetUuid(entry: any): string {
		const reference = this.objects[entry.objectIndex];
		const uuidIndex = reference.customMap.mapEntry[0].value.unsignedIntegerValue;
		return this.uuids[uuidIndex];
	}

	uuidToString(uuid: Uint8Array): string {
		return Buffer.from(uuid).toString('hex');
	}
}