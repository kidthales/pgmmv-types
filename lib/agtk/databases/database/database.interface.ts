/**
 * Agtk database interface module.
 *
 * @packageDocumentation
 */

/**
 * Agtk database interface.
 */
export interface AgtkDatabase {
  /**
   * Get an array of Column Name
   *
   * null if not found
   */
  getColumnList(): string[] | null;

  /**
   * Get an array of Column Value from Column Number
   *
   * null if not found
   *
   * @param arg Column number.
   */
  getColumnByIndex(arg: number): string[] | null;

  /**
   * Get an array of Column Value from the Column Name
   *
   * null if not found
   *
   * @param arg Column name
   */
  getColumnByName(arg: string): string[] | null;

  /**
   * Get an array of Row Name
   *
   * null if not found
   */
  getRowList(): string[] | null;

  /**
   * Get an array of Row Value from Row Number
   *
   * null if not found
   *
   * @param arg Row number
   */
  getRowByIndex(arg: number): string[] | null;

  /**
   * Get an array of Row Value from the Row Name
   *
   * null if not found
   *
   * @param arg Row name.
   */
  getRowByName(arg: string): string[] | null;

  /**
   * Get Field Value from Number
   *
   * null if not found
   *
   * @param arg1 Column number
   * @param arg2 Row number
   */
  getFieldByIndex(arg1: number, arg2: number): string | null;
}
