import { Location, Position, Range } from "vscode-languageserver";
import { AST } from "../ast";
import { Function } from "./function";

export namespace RangeReplacer {

    // export function AdjustRangeFromInsideXML(node: AST.ASTNode, documentText: string): AST.ASTNode{
    //     let XML_Ranges = AST.xmlParser.extractXMLRanges(node);
    //     for(const range of XML_Ranges){
    //         if(AST.isInRange(node.range, range)){
    //             node.range = AST.xmlParser.adjustRanges(node, documentText, node.type);
    //         }
    //     }
    //     return node;
    // }

    export function AdjustRangesInsideXML(
        all_tokens: {node: AST.ASTNode, type:number}[], 
        documentText: string,
        ast: AST.ASTNode): {node: AST.ASTNode, type:number}[]{

        let XML_Ranges = AST.xmlParser.extractXMLRanges(ast);
        
        // console.log(`XML_RANGES: ${JSON.stringify(XML_Ranges, null, 2)}`);


        for(let node of all_tokens){
            // console.log(`node RIGHT NOW: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
            let is_inside_xml = false;
            for(const range of XML_Ranges){
              if(AST.isInRange(node.node.range, range)){
                is_inside_xml = true;
                break;
              }
            }
            if(
              is_inside_xml === true && 
              node.type !== 23 &&
              node.type !== 24 &&
              node.type !== 25
            ){
            //   console.log("Is inside XML, so calling adjust Ranges!");
            //   console.log(`node: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
              node.node.range = AST.xmlParser.adjustRanges(node.node, documentText!, node.type);
        
            } else {
                // console.log(`node AFTER: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);

              continue;
            }
            // console.log(`node AFTER: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);

          }

        return all_tokens;
    }

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
        // console.log(`range looking: ${JSON.stringify(range, null, 2)}`);
        let res = AST.extractRegexPosition(documentText!, range, regexForFun);
        // console.log(`found range: ${JSON.stringify(res, AST.removeParentAndChildren, 2)}`);
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
                break;
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
                    // console.log(`found range (before modifying): ${JSON.stringify(resFunUnused, AST.removeParentAndChildren, 2)}`);
                    resFunUnused = CreateFunRange(resFunUnused, funNameUnused);
                    AdjustedNodes.push(createNewASTNode(ast, resFunUnused));
                }
                
                break;
            case 28:
                const funNameUsed = Function.getNameFromFun(ast);
                const hasSigUsed = Function.hasSignature(ast);
                // console.log(`function: ${funNameUsed}() has signature: ${hasSigUsed}`);

                if(!hasSigUsed){
                    res = CreateFunRange(range, funNameUsed);
                    AdjustedNodes.push(createNewASTNode(ast, res));
                } else {

                    let resSig = CreateFunRange(range, funNameUsed);
                    AdjustedNodes.push(createNewASTNode(ast, resSig));
                    let resFun = FindFunRange(funNameUsed, ast.range, documentText);
                    // console.log(`found range (before modifying): ${JSON.stringify(resFun, AST.removeParentAndChildren, 2)}`);
                    resFun = CreateFunRange(resFun, funNameUsed);
                    // console.log(`found range (after modifying): ${JSON.stringify(resFun, AST.removeParentAndChildren, 2)}`);

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

    export function ConvertParamsPos(paramsPos: Position): Position{
        return Position.create(paramsPos.line+2, paramsPos.character);
    }

    export function AdjustRangeAsAST(node: AST.ASTNode): AST.ASTNode{ 
        // This is added to accommodate the TextNodes having startChar of 0 after post-processing
        let startChar, endChar;
        if(node.range.start.character < 2){
            startChar = 0;
        } else {
            startChar = node.range.start.character - 2;
        }
        if(node.range.end.character < 2){
            endChar = 0;
        } else {
            endChar = node.range.end.character - 2;
        }
        let newNode = {
            type: node.type,
            value: node.value,
            children: node.children,
            range: Range.create(
                Position.create(node.range.start.line-2, startChar),
                Position.create(node.range.end.line-2, endChar)
            ),
            parent: node.parent
        } as AST.ASTNode;

        return newNode;
    }

    export function AdjustRangeAsLocation(location: Location): Location{
        return {
            uri: location.uri,
            range: Range.create(
                Position.create(location.range.start.line-2, location.range.start.character-2),
                Position.create(location.range.end.line-2, location.range.end.character-2)
            )
        };
    }

    export function AdjustRangeAsRange(range: Range): Range{
        return {
            start: {
                line: range.start.line-2,
                character: range.start.character-2
            },
            end: {
                line: range.end.line-2,
                character: range.end.character-2
            }
        };
    }
}