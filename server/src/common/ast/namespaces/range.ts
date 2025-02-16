import { Location, Position, Range } from "vscode-languageserver";
import { AST } from "../ast";
import { Function } from "./function";

export namespace RangeReplacer {

    function createNewASTNode(node: AST.ASTNode, range: Range): AST.ASTNode{
        return {
            type: node.type,
            value: node.value,
            children: node.children,
            range: range,
            parent: node.parent
        };
    }

    function CreateFunRange(range: Range, funName: string): Range{
        return Range.create(
            Position.create(range.start.line, range.start.character+4),
            Position.create(range.start.line, funName.length+range.start.character+4)
        );
    }

    function FindFunRange(funName: string, range: Range, documentText: string): Range{
        const regexForFun = new RegExp(`fun\\s+${funName}\\s*\\(`);
        console.log(`range looking: ${JSON.stringify(range, null, 2)}`);
        let res = AST.extractRegexPosition(documentText!, range, regexForFun);
        console.log(`found range: ${JSON.stringify(res, AST.removeParentAndChildren, 2)}`);
        // return res;
        return Range.create(
            Position.create(res.start.line-2, res.start.character-1),
            Position.create(res.end.line-2, res.end.character-1)
        );
    }

    export function AdjustByTypeByAST(ast: AST.ASTNode, type: number, documentText: string): AST.ASTNode[]{
        let AdjustedNodes: AST.ASTNode[] = [];
        let res: Range;
        let range = ast.range;
        switch(type){
            case 26:
                let projRange = Range.create(
                    Position.create(range.start.line, range.end.character - ast.value.length),
                    Position.create(range.start.line, range.end.character)
                );
                AdjustedNodes.push(createNewASTNode(ast, projRange));
            case 27:
                const funNameUnused = Function.getNameFromFun(ast);
                const hasSigUnused = Function.hasSignature(ast);
                
                if(!hasSigUnused){
                    res = CreateFunRange(range, funNameUnused);
                    AdjustedNodes.push(createNewASTNode(ast, res));
                } else {
                    let resSigUnused = CreateFunRange(range, funNameUnused);
                    AdjustedNodes.push(createNewASTNode(ast, resSigUnused));
                    let resFunUnused = FindFunRange(funNameUnused, ast.range, documentText);
                    console.log(`found range (before modifying): ${JSON.stringify(resFunUnused, AST.removeParentAndChildren, 2)}`);
                    resFunUnused = CreateFunRange(resFunUnused, funNameUnused);
                    AdjustedNodes.push(createNewASTNode(ast, resFunUnused));
                }
                
                break;
            case 28:
                const funNameUsed = Function.getNameFromFun(ast);
                const hasSigUsed = Function.hasSignature(ast);
                console.log(`function: ${funNameUsed}() has signature: ${hasSigUsed}`);

                if(!hasSigUsed){
                    res = CreateFunRange(range, funNameUsed);
                    AdjustedNodes.push(createNewASTNode(ast, res));
                } else {

                    let resSig = CreateFunRange(range, funNameUsed);
                    AdjustedNodes.push(createNewASTNode(ast, resSig));
                    let resFun = FindFunRange(funNameUsed, ast.range, documentText);
                    console.log(`found range (before modifying): ${JSON.stringify(resFun, AST.removeParentAndChildren, 2)}`);
                    resFun = CreateFunRange(resFun, funNameUsed);
                    console.log(`found range (after modifying): ${JSON.stringify(resFun, AST.removeParentAndChildren, 2)}`);

                    AdjustedNodes.push(createNewASTNode(ast, resFun));
                }
                break;
            case 29:
                let newRange = Range.create(
                    Position.create(range.start.line, range.start.character),
                    Position.create(range.end.line, Function.getNameFromFun(ast).length+range.start.character)
                );
                AdjustedNodes.push(createNewASTNode(ast, newRange));
                break;
            default:
                let newNode = {
                    type: ast.type,
                    value: ast.value,
                    children: ast.children,
                    range: range,
                    parent: ast.parent
                };
                AdjustedNodes.push(newNode);
                break;
        }

        

        return AdjustedNodes;
    }

    export function AdjustRangeAsAST(node: AST.ASTNode): AST.ASTNode{ 
        let newNode = {
            type: node.type,
            value: node.value,
            children: node.children,
            range: Range.create(
                Position.create(node.range.start.line-2, node.range.start.character-1),
                Position.create(node.range.end.line-2, node.range.end.character-1)
            ),
            parent: node.parent
        } as AST.ASTNode;

        return newNode;
    }

    export function AdjustRangeAsLocation(location: Location): Location{
        return {
            uri: location.uri,
            range: Range.create(
                Position.create(location.range.start.line-2, location.range.start.character-1),
                Position.create(location.range.end.line-2, location.range.end.character-1)
            )
        };
    }

    export function AdjustRangeAsRange(range: Range): Range{
        return {
            start: {
                line: range.start.line-2,
                character: range.start.character-1
            },
            end: {
                line: range.end.line-2,
                character: range.end.character-1
            }
        };
    }
}