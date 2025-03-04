import { MarkupContent, Hover as VSCodeHover } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef } from "../node";
import { Variable } from "../namespaces/variable";
import { Function } from "../namespaces/function";
import { LinksParserConstants } from "../../constants";

export function Hover(
    HoverNode: AST.ASTNode, 
    functionReferences: Map<string, FunctionNode[]>,
    functionNodeToDefMap: Map<FunctionNode, FunctionNodeDef>
): VSCodeHover | null {

    switch(HoverNode.value){
        case "FnAppl":
            let funName = Variable.getName(HoverNode.children![0]);

            if(LinksParserConstants.LINKS_FUNCS.has(funName)){
                const returnType = LinksParserConstants.LINKS_FUNC_TYPES_MAP.get(funName);
                if(returnType){
                    const content: MarkupContent = {
                        kind: 'markdown',
                        value: [
                            `### Built in Links function: ${funName}`,
                            `**Type:** ${returnType}`,
                            `\`\`\`links\nfun ${funName}() {`,
                            ``
                        ].join("\n")
                    };
                    return {
                        contents: content,
                        range: HoverNode.range
                    };
                }
            }

            let funRefs = functionReferences.get(funName);
            if(funRefs){
                for(const ref of funRefs){
                    let potentialDef = functionNodeToDefMap.get(ref);
                    if(potentialDef && AST.isInRange(HoverNode.range, potentialDef.scope.range)){
                        const num_parameters = Function.ExtractNumParamsFromDef(potentialDef.functionDefinition);
                        const parameters = Function.ExtractParamsFromDef(potentialDef.functionDefinition);
                        let params_str = "";
                        for(const param of parameters){
                            params_str += `${Variable.getName(param)}, `;
                        }
                        params_str = params_str.slice(0, -2);
                        const content: MarkupContent = {
                            kind: 'markdown',
                            value: `\`\`\`links\nfun ${funName}(${params_str}) {`                      
                        };
                        return {
                            contents: content,
                            range: HoverNode.range
                        };

                    } 
                }
            }
            break;
        default:
            return null;
    }
    return null;
}