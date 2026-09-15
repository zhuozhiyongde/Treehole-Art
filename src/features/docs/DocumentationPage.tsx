import { Book2Regular, InformationRegular, Search2Regular } from '@mingcute/react/core-regular';

const searchExamples = [
    {
        query: '机器学习 | 深度学习',
        description: '分别搜索两个关键词，合并并去除重复结果。',
    },
    {
        query: '机器学习 -:出书',
        description: '搜索“机器学习”，排除正文中含有“出书”的结果。',
    },
    {
        query: 'AI | LLM -:"Machine Learning"',
        description: '组合或搜索与短语排除；引号可以保留短语中的空格。',
    },
    {
        query: '#39403877',
        description: '搜索指定洞号，同时保留原洞和引用该洞的结果。',
    },
];

export function DocumentationPage() {
    return (
        <article className="documentation-page">
            <header className="documentation-hero">
                <span className="documentation-eyebrow">
                    <Book2Regular size={16} />
                    使用文档
                </span>
                <h1>Treehole Art</h1>
                <p>一个现代、简洁且适配多端的北大树洞第三方界面，基于 React 和 TypeScript 构建。</p>
            </header>

            <section className="documentation-section" aria-labelledby="search-guide-title">
                <div className="documentation-section-heading">
                    <Search2Regular size={19} />
                    <h2 id="search-guide-title">高级搜索</h2>
                </div>

                <div className="documentation-syntax-grid">
                    <div>
                        <code>关键词</code>
                        <strong>普通搜索</strong>
                        <p>直接交给树洞搜索接口；输入多个词时可使用空格。</p>
                    </div>
                    <div>
                        <code>A | B</code>
                        <strong>或搜索</strong>
                        <p>使用竖线分隔条件，任意一个条件匹配即可。</p>
                    </div>
                    <div>
                        <code>-:关键词</code>
                        <strong>排除结果</strong>
                        <p>从已获取的候选结果中排除包含该词的正文。</p>
                    </div>
                    <div>
                        <code>-:&quot;完整短语&quot;</code>
                        <strong>排除短语</strong>
                        <p>用单引号或双引号包裹包含空格的完整短语。</p>
                    </div>
                </div>

                <div className="documentation-examples">
                    <h3>组合示例</h3>
                    {searchExamples.map((example) => (
                        <div key={example.query}>
                            <code>{example.query}</code>
                            <p>{example.description}</p>
                        </div>
                    ))}
                </div>

                <aside className="documentation-note">
                    <InformationRegular size={17} />
                    <p>
                        “或搜索”的每个条件会独立请求并按洞号去重；排除条件在当前已加载的候选结果上执行。
                        只有排除词而没有搜索词时，范围仅限已经加载的信息流。
                    </p>
                </aside>

                <div className="documentation-tips">
                    <p>
                        按 <kbd>/</kbd> 可以随时聚焦搜索框。
                    </p>
                    <p>不同语法可以组合使用，运算顺序不依赖空格数量。</p>
                    <p>最近 8 条搜索保存在当前浏览器中；点击搜索框可以直接重新使用。</p>
                </div>
            </section>

            <section className="documentation-section" aria-labelledby="about-title">
                <div className="documentation-section-heading">
                    <InformationRegular size={19} />
                    <h2 id="about-title">关于</h2>
                </div>
                <div className="documentation-about">
                    <p>
                        Treehole Art 是使用 React 与 TypeScript 构建的开源用户脚本。它只替换浏览器中的页面界面，
                        直接复用当前浏览器已有的树洞登录状态与接口，不记录或导出登录 Token。
                    </p>
                    <p>
                        本项目并非北京大学或北大树洞官方产品。涉及发布、评论、点赞等操作时，数据会直接发送给树洞服务，不会经过第三方服务器。
                    </p>
                    <p>
                        对项目有任何疑问或建议，欢迎在 GitHub 上提交 Issue 或 Pull Request。也可以通过邮件联系作者：
                        <a
                            href="mailto:zhuozhiyongde@126.com"
                            target="_blank"
                            rel="noreferrer"
                            className="documentation-email">
                            zhuozhiyongde@126.com
                        </a>
                    </p>
                    <div className="documentation-links">
                        <a href="https://github.com/zhuozhiyongde/Treehole-Art" target="_blank" rel="noreferrer">
                            GitHub 源码
                        </a>

                        <a href="https://arthals.ink" target="_blank" rel="noreferrer">
                            Arthals' ink
                        </a>
                        <span>GNU GPL v3.0</span>
                    </div>
                </div>
            </section>
        </article>
    );
}
