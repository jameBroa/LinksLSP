import { Location, Position, Range } from "vscode-languageserver";
import { AST } from "../ast";

export namespace RangeReplacer {
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