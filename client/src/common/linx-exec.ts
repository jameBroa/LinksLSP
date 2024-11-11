import { TextDocument } from "vscode";


export const IsLinxWebPage = (document: TextDocument) => {
    const text = document.getText();
    return text.includes("servePages()");
};