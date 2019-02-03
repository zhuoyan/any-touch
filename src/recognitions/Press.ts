import { Computed } from '../interface';
import {
    STATUS_POSSIBLE,
    STATUS_CANCELLED,
    STATUS_FAILED, STATUS_RECOGNIZED
} from '../const/recognizerStatus';
import { INPUT_CANCEL, INPUT_END, INPUT_MOVE, INPUT_START } from '../const';
import Recognizer from './Base';
export default class PressRecognizer extends Recognizer {
    protected _timeoutId?: number;
    static DEFAULT_OPTIONS = {
        name: 'press',
        pointerLength: 1,
        threshold: 9,
        minPressTime: 251,
        disabled: false
    };
    constructor(options = {}) {
        super(options);
    };

    getTouchAction() {
        return ['auto'];
    };

    recognize(computed: Computed): void {
        const { inputStatus } = computed;
        if (INPUT_START === inputStatus) {
            this.status = STATUS_POSSIBLE;
        }

        if (STATUS_FAILED === this.status) return;


        // 开始识别
        if (STATUS_RECOGNIZED !== this.status) {
            // console.log(this.status, computed.distance);
            // 如果未开始按住屏幕 && 限制条件已经通过
            // 那么延迟触发press
            const IS_VALID = this.test(computed)
            // console.log({IS_VALID});
            if (IS_VALID) {
                // 延迟触发
                this.cancel();
                this._timeoutId = window.setTimeout(() => {
                    this.status = STATUS_RECOGNIZED;
                    this.emit(this.options.name, computed);
                }, this.options.minPressTime);
                // console.log('_timeoutId', this._timeoutId);
            } else {
                this.cancel();
                this.status = STATUS_FAILED;
            }

            if (INPUT_END === inputStatus) {
                this.status = STATUS_FAILED;
                // console.log(this.status);
            }
        }
        // 已识别 
        else {
            // end阶段触发pressup
            if (INPUT_END === inputStatus) {
                this.emit(`${this.options.name}up`, computed);
            }
        }
    };

    public test({ pointerLength, inputStatus, distance }: Computed): boolean {
        // const IS_VALID_INPUT = 'start' === inputStatus || 'move' === inputStatus;
        const IS_VLIAD_DISTANCE = this.options.threshold > distance;
        return this.isValidPointerLength(pointerLength) && IS_VLIAD_DISTANCE;

        // return this.isValidPointerLength(pointerLength) && IS_VALID_INPUT && IS_VLIAD_DISTANCE;
    };

    public cancel() {
        clearTimeout(this._timeoutId);
        // console.warn('cancel',this._timeoutId);
    }

    afterEmit() { }
};