// ast.js
// Factory functions for every AST node type the Trionary parser produces.
// Each factory returns a plain object with a `type` string and the node's fields.
// No classes are used — plain objects keep the AST serialisable and easy to inspect.

export function ProgramNode(body) {
  return { type: 'Program', body };
}

export function ServerDeclarationNode(port) {
  return { type: 'ServerDeclaration', port };
}

export function DatabaseDeclarationNode(uri) {
  return { type: 'DatabaseDeclaration', uri };
}

export function MiddlewareDeclarationNode(name, options) {
  return { type: 'MiddlewareDeclaration', name, options };
}

export function RouteNode(method, path, body) {
  return { type: 'Route', method, path, body };
}

export function AuthNode(required) {
  return { type: 'Auth', required };
}

export function TakeNode(fields) {
  return { type: 'Take', fields };
}

export function RequireNode(fields) {
  return { type: 'Require', fields };
}

export function ValidateNode(field, rule, value) {
  return { type: 'Validate', field, rule, value };
}

export function FindNode(target, filter, options) {
  return { type: 'Find', target, filter, options };
}

export function CreateNode(model, fields) {
  return { type: 'Create', model, fields };
}

export function UpdateNode(model, fields) {
  return { type: 'Update', model, fields };
}

export function DeleteNode(model, filter) {
  return { type: 'Delete', model, filter };
}

export function ReturnNode(value, statusCode) {
  return { type: 'Return', value, statusCode };
}

export function ExistsCheckNode(model, filter) {
  return { type: 'ExistsCheck', model, filter };
}

export function IfNode(condition, body) {
  return { type: 'If', condition, body };
}

export function HashNode(field) {
  return { type: 'Hash', field };
}

export function PaginateNode(target, limit) {
  return { type: 'Paginate', target, limit };
}

export function EscapeHatchNode(rawJs) {
  return { type: 'EscapeHatch', rawJs };
}
