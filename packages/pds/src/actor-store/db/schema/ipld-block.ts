export interface IpldBlock {
  cid: string
  repoRev: string
  size: number
  content: Uint8Array
}

export const tableName = 'ipld_block'

export type PartialDB = { [tableName]: IpldBlock }