import { InlineCompletionFeatureShape } from "vscode-languageserver/lib/common/inlineCompletion.proposed";
import { _, _Connection } from "vscode-languageserver/node";

class LinksLSPLogger {
    connection: _Connection<_, _, _, _, _, _, InlineCompletionFeatureShape, _>;
    constructor(connection: _Connection<_, _, _, _, _, _, InlineCompletionFeatureShape, _>) {
        this.connection = connection;
    }

    log(message: string) {
        this.connection.sendNotification("custom/logMessage", message);
    }
}

export default LinksLSPLogger;

// export const LogToOutput = (connection: any, message: string):void  => {
//     connection.sendNotification("custom/logMessage", message);
// };