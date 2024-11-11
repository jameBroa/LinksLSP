
export function generate_table_links_code(table_name:string, table_schema: {columnName: string; dataType: string;} []) {

    let sql_to_links = new Map<string, string>();

    // Mappings from Postgres Datatypes to Links datatypes
    // Taken from: https://www.postgresql.org/docs/current/datatype.html
    sql_to_links.set("integer", "Int");
    sql_to_links.set("text", "String");
    sql_to_links.set("double precision", "Float");
    sql_to_links.set("boolean", "Bool");
    sql_to_links.set("xml", "XML");


    let ret_str = `var ${table_name} = table "${table_name}" with (`;

    table_schema.map((elem) => {
        let links_data_type = sql_to_links.get(elem.dataType);
        ret_str += `${elem.columnName}: ${links_data_type}, `;
    });

    ret_str = ret_str.slice(0, -2);
    ret_str += ") from db;";

    return ret_str;
}