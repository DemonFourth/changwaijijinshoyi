/**
 * Cloudflare Pages Function - 运行时配置接口
 * 返回当前部署环境的配置信息
 */

export const onRequest = async (context) => {
    const env = context.env;
    
    // 从环境变量读取配置
    const workerUrl = env.WORKER_URL || '';
    const syncTimeout = parseInt(env.SYNC_TIMEOUT || '10000', 10);
    
    // 判断存储模式
    const storageMode = workerUrl ? 'hybrid' : 'local';
    
    const config = {
        sync: {
            workerUrl: workerUrl,
            timeout: syncTimeout
        },
        storageMode: storageMode
    };
    
    return new Response(JSON.stringify(config), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
};
