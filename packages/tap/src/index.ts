import { Point, Input, Computed } from '@any-touch/shared';
import {
    STATUS_RECOGNIZED,
    STATUS_POSSIBLE,
    STATUS_FAILED, INPUT_END
} from '@any-touch/shared';
import Recognizer from '@any-touch/recognizer';
import { getVLength } from '@any-touch/vector';
import { ComputeDistance, ComputeMaxLength } from '@any-touch/compute';
const DEFAULT_OPTIONS = {
    name: 'tap',
    // 触点数
    pointLength: 1,
    // 点击次数
    tapTimes: 1,
    // 等待下一次tap的时间, 
    // 超过该事件就立即判断当前点击数量
    waitNextTapTime: 300,

    // 从接触到离开允许产生的最大距离
    maxDistance: 2,
    // 2次tap之间允许的最大位移
    maxDistanceFromPrevTap: 9,
    // 从接触到离开屏幕的最大时间
    maxPressTime: 250,
};
export default class extends Recognizer {
    public tapCount: number;

    // 记录每次单击完成时的坐标
    public prevTapPoint?: Point;
    public prevTapTime?: number;

    // 多次tap之间的距离是否满足要求
    public isValidDistanceFromPrevTap?: boolean;

    private _countDownToFailTimer?: number;

    constructor(options: Partial<typeof DEFAULT_OPTIONS>) {
        super({ ...DEFAULT_OPTIONS, ...options });
        this.computeFunctions = [ComputeDistance, ComputeMaxLength];
        this.tapCount = 0;
    };

    /**
     * 判断前后2次点击的距离是否超过阈值
     * @param {Point} 当前触点中心坐标
     * @return {Boolean} 前后2次点击的距离是否超过阈值
     */
    private _isValidDistanceFromPrevTap(center: Point): boolean {
        // 判断2次点击的距离
        if (void 0 !== this.prevTapPoint) {
            const distanceFromPreviousTap = getVLength({ x: center.x - this.prevTapPoint.x, y: center.y - this.prevTapPoint.y });
            // 缓存当前点, 作为下次点击的上一点
            this.prevTapPoint = center;
            return this.options.maxDistanceFromPrevTap >= distanceFromPreviousTap;
        } else {
            this.prevTapPoint = center;
            return true;
        }
    };

    /**
     * 校验2次tap的时间间隔是否满足
     * @return {Boolean} 是否满足
     */
    private _isValidInterval(): boolean {
        const now = performance.now();
        if (void 0 === this.prevTapTime) {
            this.prevTapTime = now;
            return true;
        } else {
            const interval = now - this.prevTapTime;
            this.prevTapTime = now;
            return interval < this.options.waitNextTapTime;
        }
    };

    /**
     * 识别后执行, 流程如下:  
     *             开始   
     *              |
     *         <是否end阶段> - 否 - 结束
     *              |
     *          关闭定时器c1和c2
     *              |
     *          清除等待状态
     *              |
     *              是
     *              |
     *        重置状态为"可能是"
     *              |
     *        <是否满足单击条件> - 否 - 结束
     *              |
     *              是
     *              |
     *       <是否正确连击：是否上次点击信息为空 或 与上次点击的位移/时间是否满足约束> - 否 - 点击次数=1 - 继续(<是否到达点击数要求>)
     *              |
     *              是
     *              |
     *           点击次数+1
     *              |
     *       <是否到达点击数要求> - 否 - 设置定时器c1(t1毫秒后状态设置为"失败") - 结束
     *              |
     *              是
     *              |
     *      <是否需要其他手势失败> - 否 - 触发事件, 状态设置为"已识别",重置(点击次数,位置) - 结束
     *              |
     *              是
     *              |
     *           进入等待状态
     *              |
     *  <设置定时器c2(t1毫秒后检查"需要失败"的手势是否是"失败"状态, 重置(点击次数,位置, 等待状态)> - 否 - 设置状态为"失败" - 结束
     *              |
     *              是
     *              |
     *       触发, 状态设置为"已识别", 重置(点击次数,位置)
     *              |
     *             结束
     * 
     * @param {Input} 计算数据 
     */
    recognize(computed: Computed, emit: (type: string, ...payload: any[]) => void): void {
        const { stage, x, y } = computed;

        // 只在end阶段去识别
        if (INPUT_END !== stage) return;

        this.status = STATUS_POSSIBLE;
        // 每一次点击是否符合要求
        if (this.test(computed)) {

            this.cancelCountDownToFail();
            // 判断2次点击之间的距离是否过大
            // 对符合要求的点击进行累加
            if (this._isValidDistanceFromPrevTap({ x, y }) && this._isValidInterval()) {
                this.tapCount++;
            } else {
                this.tapCount = 1;
            }

            // 是否满足点击次数要求
            // 之所以用%, 是因为如果连续点击3次, 单击的tapCount会为3, 但是其实tap也应该触发
            if (0 === this.tapCount % this.options.tapTimes) {
                this.status = STATUS_RECOGNIZED;
                emit(this.options.name, { ...computed, tapCount: this.tapCount });
                this.reset();
            } else {
                this.countDownToFail();
            }
        } else {
            this.reset();
            this.status = STATUS_FAILED;
        }
    };

    /**
     * 指定时候后, 状态变为"失败"
     */
    countDownToFail() {
        this._countDownToFailTimer = (setTimeout as Window['setTimeout'])(() => {
            this.status = STATUS_FAILED;
            this.reset();
        }, this.options.waitNextTapTime);
    };

    cancelCountDownToFail() {
        clearTimeout(this._countDownToFailTimer);
    };

    reset() {
        this.tapCount = 0;
        this.prevTapPoint = void 0;
        this.prevTapTime = void 0;
    };

    /**
      * 识别条件
      * @param computed 计算结果
      * @return 是否验证成功
      */
    test(computed: Computed): boolean {
        const { startInput, pointLength } = computed;
        const deltaTime = computed.timestamp - startInput.timestamp;
        // 1. 触点数
        // 2. 当前点击数为0, 也就是当所有触点离开才通过
        // 3. 移动距离
        // 4. start至end的事件, 区分tap和press
        const { maxPointLength, distance } = computed;
        // console.log(this.name,pointLength, maxPointLength)
        return maxPointLength === this.options.pointLength &&
            0 === pointLength &&
            this.options.maxDistance >= distance &&
            this.options.maxPressTime > deltaTime;
    };
};