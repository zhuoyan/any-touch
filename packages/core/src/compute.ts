import AnyTouch from './index';
import type { Input, GenComputeFunction } from '@any-touch/shared';
/**
 * 计算并缓存结果,
 * 防止不同手势的相同计算函数被重复调用
 * @param at AnyTouch实例
 * @param payload 数据
 */
export default function (at: AnyTouch, payload: AnyTouchEvent) {
    function run(input: Input, computFunctions: GenComputeFunction[]) {
        for(const computFunction of computFunctions){
            const {_id} = computFunction;
            
        }
    }

    function clear() {

    }

    return [run, clear];
};