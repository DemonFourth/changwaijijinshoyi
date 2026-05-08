/**
 * Cloudflare Pages Function - 运行时配置接口
 * 返回当前部署环境的配置信息
 *
 * 本地静态模式：没有 env.DB 绑定，返回 local 模式
 * Pages 部署模式：有 env.DB 绑定，返回 hybrid 模式
 */

export const onRequest = async (context) => {
    const env = context.env;

    // 检测是否有 D1 绑定
    const hasD1 = !!env.DB;

    const config = {
        sync: {
            enabled: hasD1,
            basePath: hasD1 ? '/api/sync' : '',
            timeout: 10000
        },
        storageMode: hasD1 ? 'hybrid' : 'local'
    };

    return new Response(JSON.stringify(config), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
};
