const merkle = require('merkle')


/**
 * Build a tree given hashes as leaves and return the root optionally 
 * return path if path index is provided
 * @param leaves string[]
 * @param pathIndex number
 */
export function buildTree(leaves:string[], pathIndex?: number) : any {
    const tree = merkle('sha256', false).sync(leaves)
    return {root: tree.root(), ...( pathIndex !==undefined && pathIndex>=0 && {path: tree.getProofPath(pathIndex)}) }
}