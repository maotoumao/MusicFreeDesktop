import initDebug from 'debug';
import * as Token from 'token-types';
import { AbstractID3Parser } from '../id3v2/AbstractID3Parser.js';
import { MpcSv8Parser } from './sv8/MpcSv8Parser.js';
import { MpcSv7Parser } from './sv7/MpcSv7Parser.js';
const debug = initDebug('music-metadata:parser:musepack');
class MusepackParser extends AbstractID3Parser {
    async postId3v2Parse() {
        const signature = await this.tokenizer.peekToken(new Token.StringType(3, 'binary'));
        let mpcParser;
        switch (signature) {
            case 'MP+': {
                debug('Musepack stream-version 7');
                mpcParser = new MpcSv7Parser();
                break;
            }
            case 'MPC': {
                debug('Musepack stream-version 8');
                mpcParser = new MpcSv8Parser();
                break;
            }
            default: {
                throw new Error('Invalid Musepack signature prefix');
            }
        }
        mpcParser.init(this.metadata, this.tokenizer, this.options);
        return mpcParser.parse();
    }
}
export default MusepackParser;
