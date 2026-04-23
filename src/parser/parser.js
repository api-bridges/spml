// parser.js
// Recursive-descent parser that converts a Trionary token stream into an AST.
// Exports parse(tokens) → ProgramNode and parseFile(path) → ProgramNode.
// Throws structured error objects { message, line, col, source } on bad syntax.

import { tokenizeFile } from '../lexer/lexer.js';
import { TOKEN_TYPES } from '../lexer/tokens.js';
import { TrinaryError } from '../errors/TrinaryError.js';
import { suggest } from '../errors/suggestions.js';
import { MESSAGES, interpolate } from '../errors/messages.js';
import {
  ProgramNode,
  ServerDeclarationNode,
  DatabaseDeclarationNode,
  DatabaseTypeDeclarationNode,
  MiddlewareDeclarationNode,
  MiddlewareNode,
  RouteNode,
  AuthNode,
  TakeNode,
  RequireNode,
  ValidateNode,
  FindNode,
  CreateNode,
  UpdateNode,
  DeleteNode,
  ReturnNode,
  ExistsCheckNode,
  IfNode,
  HashNode,
  PaginateNode,
  EscapeHatchNode,
  FieldNode,
  PopulateNode,
  ImportNode,
  StreamNode,
  SocketNode,
  BroadcastNode,
  JobNode,
  TestNode,
  SendNode,
  ExpectNode,
} from './ast.js';

// Token types that represent explicit scalar field types
const FIELD_TYPE_TOKEN_TYPES = new Set([
  TOKEN_TYPES.TYPE_STRING,
  TOKEN_TYPES.TYPE_NUMBER,
  TOKEN_TYPES.TYPE_BOOLEAN,
  TOKEN_TYPES.TYPE_DATE,
]);

// Keywords that begin block-level statements (used to detect where an if-condition ends)
const BODY_KEYWORDS = new Set([
  'return', 'auth', 'take', 'require', 'validate',
  'find', 'create', 'update', 'delete', 'hash', 'paginate', 'populate',
]);

// Human-readable list of valid statement-level keywords (used in error hints)
const STATEMENT_KEYWORDS_LIST =
  'auth, take, require, validate, find, create, update, delete, return, exists, if, hash, paginate, populate, stream, broadcast';

// Parse a numeric string, throwing a structured error if the result is NaN.
function parseNumber(token) {
  const n = Number(token.value);
  if (Number.isNaN(n)) {
    throw new TrinaryError(interpolate(MESSAGES.INVALID_NUMBER, { value: token.value }), {
      line: token.line, col: token.col, source: 'parser',
    });
  }
  return n;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // ── Token navigation ───────────────────────────────────────────────────────

  peek() {
    return this.tokens[this.pos];
  }

  advance() {
    const token = this.tokens[this.pos];
    if (token.type !== TOKEN_TYPES.EOF) this.pos++;
    return token;
  }

  check(type, value = null) {
    const t = this.peek();
    return t.type === type && (value === null || t.value === value);
  }

  match(type, value = null) {
    if (this.check(type, value)) return this.advance();
    return null;
  }

  expect(type, value = null) {
    const t = this.peek();
    if (t.type !== type || (value !== null && t.value !== value)) {
      const got = `${t.type}(${t.value})`;
      const expected = value !== null ? `${type}(${value})` : type;
      throw new TrinaryError(interpolate(MESSAGES.EXPECTED_TOKEN, { expected, got }), {
        line: t.line, col: t.col, source: 'parser',
      });
    }
    return this.advance();
  }

  // Expect either an IDENTIFIER or a KEYWORD token (field names can be either)
  expectIdentifierOrKeyword() {
    const t = this.peek();
    if (t.type === TOKEN_TYPES.IDENTIFIER || t.type === TOKEN_TYPES.KEYWORD) {
      return this.advance();
    }
    throw new TrinaryError(interpolate(MESSAGES.EXPECTED_IDENTIFIER, { got: `${t.type}(${t.value})` }), {
      line: t.line, col: t.col, source: 'parser',
    });
  }

  isLineEnd() {
    const type = this.peek().type;
    return type === TOKEN_TYPES.NEWLINE || type === TOKEN_TYPES.DEDENT || type === TOKEN_TYPES.EOF;
  }

  // Consume any leading NEWLINE tokens
  skipNewlines() {
    while (this.check(TOKEN_TYPES.NEWLINE)) this.advance();
  }

  // Consume zero or more trailing NEWLINEs at the end of a statement
  consumeNewline() {
    while (this.check(TOKEN_TYPES.NEWLINE)) this.advance();
  }

  // ── Top-level ──────────────────────────────────────────────────────────────

  parseProgram() {
    const body = [];
    let dbType = 'mongodb';
    this.skipNewlines();
    while (!this.check(TOKEN_TYPES.EOF)) {
      const node = this.parseTopLevel();
      if (node.type === 'DatabaseTypeDeclaration') {
        dbType = node.dbType;
      } else {
        body.push(node);
      }
      this.skipNewlines();
    }
    return ProgramNode(body, dbType);
  }

  parseTopLevel() {
    const t = this.peek();
    if (t.type === TOKEN_TYPES.KEYWORD) {
      switch (t.value) {
        case 'server':     return this.parseServerDeclaration();
        case 'database':   return this.parseDatabaseDeclaration();
        case 'middleware': return this.parseMiddlewareDeclaration();
        case 'route':      return this.parseRoute();
        case 'socket':     return this.parseSocket();
        case 'job':        return this.parseJob();
        case 'test':       return this.parseTest();
      }
    }
    if (t.type === TOKEN_TYPES.IMPORT) {
      return this.parseImport();
    }
    throw new TrinaryError(interpolate(MESSAGES.UNEXPECTED_TOP_LEVEL, { token: `${t.type}(${t.value})` }), {
      line: t.line, col: t.col, source: 'parser',
      hint: 'Valid top-level keywords are: server, database, import, job, middleware, route, socket, test.',
    });
  }

  // server port <number>
  // server port env <VAR_NAME>
  parseServerDeclaration() {
    this.expect(TOKEN_TYPES.KEYWORD, 'server');
    this.expect(TOKEN_TYPES.KEYWORD, 'port');
    if (this.match(TOKEN_TYPES.ENV)) {
      const varToken = this.expect(TOKEN_TYPES.IDENTIFIER);
      this.consumeNewline();
      return ServerDeclarationNode(null, varToken.value);
    }
    const portToken = this.expect(TOKEN_TYPES.NUMBER);
    this.consumeNewline();
    return ServerDeclarationNode(parseNumber(portToken));
  }

  // database connect "<uri>"
  // database connect env <VAR_NAME>
  // database type mongodb
  // database type postgres
  parseDatabaseDeclaration() {
    this.expect(TOKEN_TYPES.KEYWORD, 'database');
    // Peek at the next keyword to decide which form this is
    const subToken = this.peek();
    if (subToken.type === TOKEN_TYPES.KEYWORD && subToken.value === 'type') {
      this.advance(); // consume 'type'
      const dbTypeToken = this.expect(TOKEN_TYPES.KEYWORD);
      if (dbTypeToken.value !== 'mongodb' && dbTypeToken.value !== 'postgres' && dbTypeToken.value !== 'sqlite') {
        throw new TrinaryError(
          `Unknown database type '${dbTypeToken.value}'. Expected 'mongodb', 'postgres', or 'sqlite'.`,
          { line: dbTypeToken.line, col: dbTypeToken.col, source: 'parser' },
        );
      }
      this.consumeNewline();
      return DatabaseTypeDeclarationNode(dbTypeToken.value);
    }
    this.expect(TOKEN_TYPES.KEYWORD, 'connect');
    if (this.match(TOKEN_TYPES.ENV)) {
      const varToken = this.expect(TOKEN_TYPES.IDENTIFIER);
      this.consumeNewline();
      return DatabaseDeclarationNode(null, varToken.value);
    }
    const uriToken = this.expect(TOKEN_TYPES.STRING);
    this.consumeNewline();
    return DatabaseDeclarationNode(uriToken.value);
  }

  // middleware <name> [max <n> per minute]
  // middleware <packageName>  — any npm package name (IDENTIFIER token)
  parseMiddlewareDeclaration() {
    this.expect(TOKEN_TYPES.KEYWORD, 'middleware');
    const nameToken = this.expectIdentifierOrKeyword();
    // Non-keyword tokens are arbitrary npm package names → MiddlewareNode
    if (nameToken.type === TOKEN_TYPES.IDENTIFIER) {
      this.consumeNewline();
      return MiddlewareNode(nameToken.value);
    }
    const options = {};
    if (nameToken.value === 'ratelimit' && !this.isLineEnd()) {
      if (this.match(TOKEN_TYPES.KEYWORD, 'max')) {
        options.max = parseNumber(this.expect(TOKEN_TYPES.NUMBER));
        if (this.match(TOKEN_TYPES.KEYWORD, 'per')) {
          this.expect(TOKEN_TYPES.KEYWORD, 'minute');
        }
      }
    }
    this.consumeNewline();
    return MiddlewareDeclarationNode(nameToken.value, options);
  }

  // import routes from "<path>"
  parseImport() {
    this.expect(TOKEN_TYPES.IMPORT);
    this.expect(TOKEN_TYPES.ROUTES);
    this.expect(TOKEN_TYPES.FROM);
    const pathToken = this.expect(TOKEN_TYPES.STRING);
    this.consumeNewline();
    return ImportNode(pathToken.value);
  }

  // route <METHOD> <path>
  //   <block>
  parseRoute() {
    this.expect(TOKEN_TYPES.KEYWORD, 'route');
    const methodToken = this.expect(TOKEN_TYPES.KEYWORD);
    const pathParts = [];
    while (!this.isLineEnd()) {
      pathParts.push(this.advance().value);
    }
    this.consumeNewline();
    const body = this.parseBlock();
    return RouteNode(methodToken.value, pathParts.join(''), body);
  }

  // Indented block of statements
  parseBlock() {
    const body = [];
    if (!this.check(TOKEN_TYPES.INDENT)) return body;
    this.advance(); // consume INDENT
    this.skipNewlines();
    while (!this.check(TOKEN_TYPES.DEDENT) && !this.check(TOKEN_TYPES.EOF)) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    if (this.check(TOKEN_TYPES.DEDENT)) this.advance();
    return body;
  }

  // ── Statement dispatch ─────────────────────────────────────────────────────

  parseStatement() {
    const t = this.peek();
    if (t.type === TOKEN_TYPES.KEYWORD) {
      switch (t.value) {
        case 'auth':     return this.parseAuth();
        case 'take':     return this.parseTake();
        case 'require':  return this.parseRequire();
        case 'validate': return this.parseValidate();
        case 'find':     return this.parseFind();
        case 'create':   return this.parseCreate();
        case 'update':   return this.parseUpdate();
        case 'delete':   return this.parseDelete();
        case 'return':   return this.parseReturn();
        case 'exists':   return this.parseExistsCheck();
        case 'if':       return this.parseIf();
        case 'hash':     return this.parseHash();
        case 'paginate': return this.parsePaginate();
        case 'populate': return this.parsePopulate();
        case 'stream':   return this.parseStream();
        case 'broadcast': return this.parseBroadcast();
      }
    }
    // Escape hatch: `js:` block or legacy `escape` identifier
    if (t.type === TOKEN_TYPES.IDENTIFIER) {
      if (t.value === 'escape') return this.parseEscapeHatch();
      if (t.value === 'js') {
        const next = this.tokens[this.pos + 1];
        if (next && next.type === TOKEN_TYPES.OPERATOR && next.value === ':') {
          return this.parseEscapeHatch();
        }
      }
    }
    const suggestion = suggest(t.value);
    const msgTemplate = suggestion ? MESSAGES.UNEXPECTED_TOKEN : MESSAGES.UNEXPECTED_TOKEN_NO_HINT;
    const msg = interpolate(msgTemplate, { token: `${t.type}(${t.value})`, suggestion: suggestion ?? '' });
    throw new TrinaryError(msg, {
      line: t.line, col: t.col, source: 'parser',
      hint: `Valid statement keywords are: ${STATEMENT_KEYWORDS_LIST}.`,
    });
  }

  // ── Individual statement parsers ───────────────────────────────────────────

  // auth required
  parseAuth() {
    this.expect(TOKEN_TYPES.KEYWORD, 'auth');
    let required = false;
    if (!this.isLineEnd()) {
      const t = this.peek();
      if ((t.type === TOKEN_TYPES.IDENTIFIER || t.type === TOKEN_TYPES.KEYWORD) && t.value === 'required') {
        this.advance();
        required = true;
      }
    }
    this.consumeNewline();
    return AuthNode(required);
  }

  // take <field>, <field>, ...
  parseTake() {
    this.expect(TOKEN_TYPES.KEYWORD, 'take');
    const fields = this.parseCommaSeparatedIdentifiers();
    this.consumeNewline();
    return TakeNode(fields);
  }

  // require <field>, <field>, ...
  parseRequire() {
    this.expect(TOKEN_TYPES.KEYWORD, 'require');
    const fields = this.parseCommaSeparatedIdentifiers();
    this.consumeNewline();
    return RequireNode(fields);
  }

  // validate <field> is email
  // validate <field> is number
  // validate <field> is url
  // validate <field> is one of "<v1>", "<v2>", …
  // validate <field> min length <n>
  // validate <field> min length <n> max length <m>
  parseValidate() {
    this.expect(TOKEN_TYPES.KEYWORD, 'validate');
    const fieldToken = this.expectIdentifierOrKeyword();

    if (this.match(TOKEN_TYPES.KEYWORD, 'is')) {
      const ruleToken = this.expectIdentifierOrKeyword();
      if (ruleToken.value === 'one') {
        // is one of "<v1>", "<v2>", …
        this.expect(TOKEN_TYPES.KEYWORD, 'of');
        const values = [this.expect(TOKEN_TYPES.STRING).value];
        while (this.match(TOKEN_TYPES.OPERATOR, ',')) {
          values.push(this.expect(TOKEN_TYPES.STRING).value);
        }
        this.consumeNewline();
        return ValidateNode(fieldToken.value, 'is one of', values);
      }
      // is email | is number | is url
      this.consumeNewline();
      return ValidateNode(fieldToken.value, `is ${ruleToken.value}`, null);
    }

    if (this.match(TOKEN_TYPES.KEYWORD, 'min')) {
      // min length <n> [max length <m>]
      this.expect(TOKEN_TYPES.KEYWORD, 'length');
      const minVal = parseNumber(this.expect(TOKEN_TYPES.NUMBER));
      if (!this.isLineEnd() && this.check(TOKEN_TYPES.KEYWORD, 'max')) {
        this.advance(); // consume 'max'
        this.expect(TOKEN_TYPES.KEYWORD, 'length');
        const maxVal = parseNumber(this.expect(TOKEN_TYPES.NUMBER));
        this.consumeNewline();
        return ValidateNode(fieldToken.value, 'min max length', { min: minVal, max: maxVal });
      }
      this.consumeNewline();
      return ValidateNode(fieldToken.value, 'min length', minVal);
    }

    const t = this.peek();
    throw new TrinaryError(
      `Unexpected validate rule token: ${t.type}(${t.value}). Expected 'is' or 'min'.`,
      { line: t.line, col: t.col, source: 'parser' },
    );
  }

  // find [all] <model> [sorted by <field>] [where <field> [<value>]]
  parseFind() {
    this.expect(TOKEN_TYPES.KEYWORD, 'find');
    this.match(TOKEN_TYPES.KEYWORD, 'all');
    const modelToken = this.expectIdentifierOrKeyword();
    let filter = null;
    const options = {};
    while (!this.isLineEnd()) {
      if (this.match(TOKEN_TYPES.KEYWORD, 'sorted')) {
        this.expect(TOKEN_TYPES.KEYWORD, 'by');
        options.sortBy = this.expectIdentifierOrKeyword().value;
      } else if (this.match(TOKEN_TYPES.KEYWORD, 'where')) {
        const fieldToken = this.expectIdentifierOrKeyword();
        if (!this.isLineEnd() && !this.check(TOKEN_TYPES.KEYWORD, 'sorted')) {
          filter = { field: fieldToken.value, value: this.expectIdentifierOrKeyword().value };
        } else {
          filter = fieldToken.value;
        }
      } else if (this.match(TOKEN_TYPES.KEYWORD, 'by')) {
        filter = { by: this.expectIdentifierOrKeyword().value };
      } else {
        break;
      }
    }
    this.consumeNewline();
    return FindNode(modelToken.value, filter, options);
  }

  // create <model> with <field>[: <Type>], <field>[: <Type>], ...
  parseCreate() {
    this.expect(TOKEN_TYPES.KEYWORD, 'create');
    const modelToken = this.expectIdentifierOrKeyword();
    this.expect(TOKEN_TYPES.KEYWORD, 'with');
    const fields = this.parseTypedFieldList();
    this.consumeNewline();
    return CreateNode(modelToken.value, fields);
  }

  // update <model> with <field>[: <Type>], <field>[: <Type>], ...
  parseUpdate() {
    this.expect(TOKEN_TYPES.KEYWORD, 'update');
    const modelToken = this.expectIdentifierOrKeyword();
    this.expect(TOKEN_TYPES.KEYWORD, 'with');
    const fields = this.parseTypedFieldList();
    this.consumeNewline();
    return UpdateNode(modelToken.value, fields);
  }

  // delete <model> by <field>
  parseDelete() {
    this.expect(TOKEN_TYPES.KEYWORD, 'delete');
    const modelToken = this.expectIdentifierOrKeyword();
    this.expect(TOKEN_TYPES.KEYWORD, 'by');
    const fieldToken = this.expectIdentifierOrKeyword();
    this.consumeNewline();
    return DeleteNode(modelToken.value, fieldToken.value);
  }

  // return [error "<msg>" | ok | <identifier>] [status <code>]
  parseReturn() {
    this.expect(TOKEN_TYPES.KEYWORD, 'return');
    let value = null;
    let statusCode = null;
    if (!this.isLineEnd()) {
      if (this.match(TOKEN_TYPES.KEYWORD, 'error')) {
        const msgToken = this.expect(TOKEN_TYPES.STRING);
        value = { error: msgToken.value };
      } else if (this.match(TOKEN_TYPES.KEYWORD, 'ok')) {
        value = 'ok';
      } else if (this.check(TOKEN_TYPES.STRING)) {
        value = this.advance().value;
      } else {
        value = this.expectIdentifierOrKeyword().value;
        // Handle the two-word phrase "current user"
        if (value === 'current' && !this.isLineEnd()) {
          const nxt = this.peek();
          if (
            (nxt.type === TOKEN_TYPES.IDENTIFIER || nxt.type === TOKEN_TYPES.KEYWORD) &&
            nxt.value === 'user'
          ) {
            this.advance();
            value = 'current user';
          }
        }
      }
    }
    if (this.match(TOKEN_TYPES.KEYWORD, 'status')) {
      statusCode = parseNumber(this.expect(TOKEN_TYPES.NUMBER));
    }
    this.consumeNewline();
    return ReturnNode(value, statusCode);
  }

  // exists <model> where <field>
  parseExistsCheck() {
    this.expect(TOKEN_TYPES.KEYWORD, 'exists');
    const modelToken = this.expectIdentifierOrKeyword();
    this.expect(TOKEN_TYPES.KEYWORD, 'where');
    const filterToken = this.expectIdentifierOrKeyword();
    this.consumeNewline();
    return ExistsCheckNode(modelToken.value, filterToken.value);
  }

  // if <condition-tokens> <statement> | INDENT <block> DEDENT
  parseIf() {
    this.expect(TOKEN_TYPES.KEYWORD, 'if');
    const condParts = [];
    while (!this.isLineEnd()) {
      const t = this.peek();
      if (t.type === TOKEN_TYPES.KEYWORD && BODY_KEYWORDS.has(t.value)) break;
      condParts.push(this.advance().value);
    }
    const condition = condParts.join(' ');
    let body = [];
    if (!this.isLineEnd()) {
      const stmt = this.parseStatement();
      if (stmt) body = [stmt];
    } else {
      this.consumeNewline();
      body = this.parseBlock();
    }
    return IfNode(condition, body);
  }

  // hash <field>
  parseHash() {
    this.expect(TOKEN_TYPES.KEYWORD, 'hash');
    const fieldToken = this.expectIdentifierOrKeyword();
    this.consumeNewline();
    return HashNode(fieldToken.value);
  }

  // paginate <target> limit <n>
  parsePaginate() {
    this.expect(TOKEN_TYPES.KEYWORD, 'paginate');
    const targetToken = this.expectIdentifierOrKeyword();
    this.expect(TOKEN_TYPES.KEYWORD, 'limit');
    const limitToken = this.expect(TOKEN_TYPES.NUMBER);
    this.consumeNewline();
    return PaginateNode(targetToken.value, parseNumber(limitToken));
  }

  // populate <model>.<field>
  parsePopulate() {
    this.expect(TOKEN_TYPES.KEYWORD, 'populate');
    const modelToken = this.expectIdentifierOrKeyword();
    this.expect(TOKEN_TYPES.OPERATOR, '.');
    const fieldToken = this.expectIdentifierOrKeyword();
    this.consumeNewline();
    return PopulateNode(modelToken.value, fieldToken.value);
  }

  // stream events
  parseStream() {
    this.expect(TOKEN_TYPES.KEYWORD, 'stream');
    this.expect(TOKEN_TYPES.KEYWORD, 'events');
    this.consumeNewline();
    return StreamNode();
  }

  // socket <path>
  //   on <event>
  //     <block>
  parseSocket() {
    this.expect(TOKEN_TYPES.KEYWORD, 'socket');
    const pathParts = [];
    while (!this.isLineEnd()) {
      pathParts.push(this.advance().value);
    }
    this.consumeNewline();

    let event = 'message';
    let body = [];

    if (this.check(TOKEN_TYPES.INDENT)) {
      this.advance(); // consume INDENT
      this.skipNewlines();
      if (this.check(TOKEN_TYPES.KEYWORD) && this.peek().value === 'on') {
        this.advance(); // consume 'on'
        const eventToken = this.expectIdentifierOrKeyword();
        event = eventToken.value;
        this.consumeNewline();
        body = this.parseBlock();
      }
      // Skip any remaining top-level content inside the socket block.
      // Only the first `on <event>` handler is compiled; additional content
      // at this indentation level is currently unsupported and skipped to
      // allow forward-compatible extension of the socket block syntax.
      while (!this.check(TOKEN_TYPES.DEDENT) && !this.check(TOKEN_TYPES.EOF)) {
        this.advance();
      }
      if (this.check(TOKEN_TYPES.DEDENT)) this.advance();
    }

    return SocketNode(pathParts.join(''), event, body);
  }

  // job daily at midnight
  // job daily at noon
  // job weekly
  // job every <n> minutes|hours|seconds
  //   <block>
  parseJob() {
    this.expect(TOKEN_TYPES.KEYWORD, 'job');

    let schedule;

    if (this.match(TOKEN_TYPES.KEYWORD, 'daily')) {
      if (this.match(TOKEN_TYPES.KEYWORD, 'at')) {
        if (this.match(TOKEN_TYPES.KEYWORD, 'midnight')) {
          schedule = '0 0 * * *';
        } else if (this.match(TOKEN_TYPES.KEYWORD, 'noon')) {
          schedule = '0 12 * * *';
        } else {
          const t = this.peek();
          throw new TrinaryError(
            `Expected 'midnight' or 'noon' after 'daily at' but got ${t.type}(${t.value})`,
            { line: t.line, col: t.col, source: 'parser' },
          );
        }
      } else {
        schedule = '0 0 * * *';
      }
    } else if (this.match(TOKEN_TYPES.KEYWORD, 'weekly')) {
      schedule = '0 0 * * 0';
    } else if (this.match(TOKEN_TYPES.KEYWORD, 'every')) {
      const nToken = this.expect(TOKEN_TYPES.NUMBER);
      const n = parseNumber(nToken);
      const unitToken = this.expectIdentifierOrKeyword();
      const unit = unitToken.value;
      if (unit === 'minutes' || unit === 'minute') {
        schedule = `*/${n} * * * *`;
      } else if (unit === 'hours' || unit === 'hour') {
        schedule = `0 */${n} * * *`;
      } else if (unit === 'seconds' || unit === 'second') {
        schedule = `*/${n} * * * * *`;
      } else {
        throw new TrinaryError(
          `Unknown schedule unit '${unit}'. Expected 'minutes', 'hours', or 'seconds'.`,
          { line: unitToken.line, col: unitToken.col, source: 'parser' },
        );
      }
    } else {
      const t = this.peek();
      throw new TrinaryError(
        `Unexpected job schedule token: ${t.type}(${t.value}). Expected 'daily', 'weekly', or 'every'.`,
        { line: t.line, col: t.col, source: 'parser' },
      );
    }

    this.consumeNewline();
    const body = this.parseBlock();
    return JobNode(schedule, body);
  }

  // test "<description>"
  //   send <METHOD> <path> [with <field> "<value>", ...]
  //   expect status <code>
  //   expect body.<field> exists
  //   expect body.<field> "<value>"
  parseTest() {
    this.expect(TOKEN_TYPES.KEYWORD, 'test');
    const descToken = this.expect(TOKEN_TYPES.STRING);
    this.consumeNewline();
    const body = this.parseTestBlock();
    return TestNode(descToken.value, body);
  }

  parseTestBlock() {
    const body = [];
    if (!this.check(TOKEN_TYPES.INDENT)) return body;
    this.advance(); // consume INDENT
    this.skipNewlines();
    while (!this.check(TOKEN_TYPES.DEDENT) && !this.check(TOKEN_TYPES.EOF)) {
      const t = this.peek();
      if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'send') {
        body.push(this.parseSend());
      } else if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'expect') {
        body.push(this.parseExpect());
      } else {
        break;
      }
      this.skipNewlines();
    }
    if (this.check(TOKEN_TYPES.DEDENT)) this.advance();
    return body;
  }

  // send <METHOD> <path> [with <field> "<value>", ...]
  parseSend() {
    this.expect(TOKEN_TYPES.KEYWORD, 'send');
    const methodToken = this.expect(TOKEN_TYPES.KEYWORD);
    const pathParts = [];
    while (!this.isLineEnd()) {
      const t = this.peek();
      if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'with') break;
      pathParts.push(this.advance().value);
    }
    const path = pathParts.join('');
    let fields = [];
    if (this.match(TOKEN_TYPES.KEYWORD, 'with')) {
      fields = this.parseSendFields();
    }
    this.consumeNewline();
    return SendNode(methodToken.value, path, fields);
  }

  // Parse comma-separated <fieldName> "<value>" pairs
  parseSendFields() {
    const fields = [];
    do {
      const nameToken = this.expectIdentifierOrKeyword();
      const valueToken = this.expect(TOKEN_TYPES.STRING);
      fields.push({ name: nameToken.value, value: valueToken.value });
    } while (this.match(TOKEN_TYPES.OPERATOR, ','));
    return fields;
  }

  // expect status <code>
  // expect body.<field> exists
  // expect body.<field> "<value>"
  parseExpect() {
    this.expect(TOKEN_TYPES.KEYWORD, 'expect');
    if (this.match(TOKEN_TYPES.KEYWORD, 'status')) {
      const codeToken = this.expect(TOKEN_TYPES.NUMBER);
      this.consumeNewline();
      return ExpectNode('status', { code: parseNumber(codeToken) });
    }
    if (this.match(TOKEN_TYPES.KEYWORD, 'body')) {
      this.expect(TOKEN_TYPES.OPERATOR, '.');
      const fieldToken = this.expectIdentifierOrKeyword();
      if (this.match(TOKEN_TYPES.KEYWORD, 'exists')) {
        this.consumeNewline();
        return ExpectNode('body', { path: fieldToken.value, check: 'exists' });
      }
      const valueToken = this.expect(TOKEN_TYPES.STRING);
      this.consumeNewline();
      return ExpectNode('body', { path: fieldToken.value, check: { equals: valueToken.value } });
    }
    const t = this.peek();
    throw new TrinaryError(
      `Expected 'status' or 'body' after 'expect', got ${t.type}(${t.value})`,
      { line: t.line, col: t.col, source: 'parser' },
    );
  }

  // broadcast <data>
  parseBroadcast() {
    this.expect(TOKEN_TYPES.KEYWORD, 'broadcast');
    const dataToken = this.expectIdentifierOrKeyword();
    this.consumeNewline();
    return BroadcastNode(dataToken.value);
  }

  // js:
  //   <raw js block>
  // or legacy:
  // escape
  //   <raw js block>
  parseEscapeHatch() {
    const startToken = this.peek();
    const line = startToken.line;

    if (startToken.value === 'js') {
      this.advance(); // consume 'js'
      this.expect(TOKEN_TYPES.OPERATOR, ':'); // consume ':'
    } else {
      this.advance(); // consume 'escape'
    }

    this.consumeNewline();
    const parts = [];
    if (this.check(TOKEN_TYPES.INDENT)) {
      this.advance(); // consume INDENT
      while (!this.check(TOKEN_TYPES.DEDENT) && !this.check(TOKEN_TYPES.EOF)) {
        if (this.check(TOKEN_TYPES.NEWLINE)) {
          parts.push('\n');
          this.advance();
        } else {
          parts.push(this.advance().value);
        }
      }
      if (this.check(TOKEN_TYPES.DEDENT)) this.advance();
      return EscapeHatchNode(parts.join('').trim(), line);
    } else {
      while (!this.isLineEnd()) {
        parts.push(this.advance().value);
      }
      this.consumeNewline();
      return EscapeHatchNode(parts.join(' ').trim(), line);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Parse a comma-separated list of identifiers/keywords
  parseCommaSeparatedIdentifiers() {
    const fields = [this.expectIdentifierOrKeyword().value];
    while (this.match(TOKEN_TYPES.OPERATOR, ',')) {
      fields.push(this.expectIdentifierOrKeyword().value);
    }
    return fields;
  }

  // Parse a comma-separated list of fields with optional `: TypeKeyword` suffixes
  // and an optional `ref: ModelName` modifier.
  // Returns an array of FieldNode objects.
  parseTypedFieldList() {
    const fields = [];
    const parseSingle = () => {
      const nameToken = this.expectIdentifierOrKeyword();
      let fieldType = 'String';
      let ref = null;
      if (this.match(TOKEN_TYPES.OPERATOR, ':')) {
        const typeToken = this.peek();
        if (FIELD_TYPE_TOKEN_TYPES.has(typeToken.type)) {
          fieldType = this.advance().value;
        } else {
          throw new TrinaryError(
            `Expected a field type (String, Number, Boolean, Date) but got ${typeToken.type}(${typeToken.value})`,
            { line: typeToken.line, col: typeToken.col, source: 'parser' },
          );
        }
      }
      // Optional `ref: ModelName` modifier
      if (this.check(TOKEN_TYPES.KEYWORD, 'ref')) {
        this.advance(); // consume 'ref'
        this.expect(TOKEN_TYPES.OPERATOR, ':');
        ref = this.expectIdentifierOrKeyword().value;
      }
      return FieldNode(nameToken.value, fieldType, ref);
    };
    fields.push(parseSingle());
    while (this.match(TOKEN_TYPES.OPERATOR, ',')) {
      fields.push(parseSingle());
    }
    return fields;
  }
}

/**
 * Parse a flat token array into a ProgramNode AST.
 *
 * @param {{ type: string, value: string, line: number, col: number }[]} tokens
 * @returns {object} ProgramNode
 */
export function parse(tokens) {
  return new Parser(tokens).parseProgram();
}

/**
 * Read a `.tri` file from disk, tokenise it, and parse it into an AST.
 *
 * @param {string} path - Absolute or relative path to a `.tri` file.
 * @returns {Promise<object>} ProgramNode
 */
export async function parseFile(path) {
  const tokens = await tokenizeFile(path);
  return parse(tokens);
}
