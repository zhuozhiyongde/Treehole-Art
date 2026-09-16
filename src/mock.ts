import type { BookmarkGroup, Hole, Tag, TagNode, TreeholeComment } from "./types";

const now = Math.floor(Date.now() / 1000);

export const mockTags: TagNode[] = [
  {
    id: 101,
    tag_name: "学习与发展",
    children: [
      { id: 1, tag_name: "课程心得" },
      { id: 3, tag_name: "求职经历" },
      { id: 4, tag_name: "科研交流" },
    ],
  },
  {
    id: 102,
    tag_name: "校园生活",
    children: [
      { id: 2, tag_name: "失物招领" },
      { id: 6, tag_name: "活动组队" },
      { id: 7, tag_name: "日常分享" },
    ],
  },
  {
    id: 103,
    tag_name: "交易与互助",
    children: [
      { id: 5, tag_name: "跳蚤市场" },
      { id: 8, tag_name: "求助问询" },
    ],
  },
];

const mockLeafTags = mockTags.flatMap((group) => group.children ?? []) as Tag[];

export const mockBookmarks: BookmarkGroup[] = [
  { id: 1, bookmark_name: "稍后再看", hole_count: 1 },
  { id: 2, bookmark_name: "课程参考", hole_count: 1 },
];

export const mockHoles: Hole[] = [
  {
    pid: 39403910,
    text: "接上 #39403877，绕湖散步回来，心情确实轻松了很多。",
    type: "text",
    timestamp: now - 3 * 60,
    likenum: 24,
    reply: 1,
    is_follow: 0,
    children_pid: 39403877,
  },
  {
    pid: 39403877,
    text: "在未名湖边看到了今年第一片变黄的叶子。新学期开始得很快，也想提醒自己：忙碌之外，记得留一点时间给没有目的的散步。",
    type: "text",
    timestamp: now - 8 * 60,
    likenum: 128,
    reply: 3,
    is_follow: 0,
    is_top: 1,
    tag: "日常",
  },
  {
    pid: 39403741,
    text: "求推荐适合第一次接触机器学习的数学课程。已经学过高数、线代，但概率论基础一般，希望课程作业不要太重。",
    type: "text",
    timestamp: now - 23 * 60,
    likenum: 36,
    reply: 18,
    is_follow: 1,
    label_info: mockLeafTags[0],
    bookmark: { bookmark: mockBookmarks[1] },
  },
  {
    pid: 39403602,
    text: "二教 405 最后一排捡到一只黑色无线耳机，已经交到一层服务台。失主可以带另一只耳机去认领。",
    type: "text",
    timestamp: now - 41 * 60,
    likenum: 52,
    reply: 7,
    is_follow: 0,
    label_info: mockLeafTags[3],
  },
  {
    pid: 39403489,
    text: "今年秋招的一个小结：技术面比想象中更看重项目取舍，而不是把所有名词都讲一遍。把简历上每个决定背后的理由想清楚，会比继续堆项目更有帮助。",
    type: "text",
    timestamp: now - 68 * 60,
    likenum: 94,
    reply: 31,
    is_follow: 1,
    label_info: mockLeafTags[1],
    bookmark: { bookmark: mockBookmarks[0] },
  },
  {
    pid: 39403318,
    text: "有没有人今晚一起去看百讲的新生音乐会？临时多一张票，原价出，结束后可以一起走回宿舍。",
    type: "text",
    kind: 1,
    reward_cost: 12,
    has_reward_good: 1,
    islz: 1,
    timestamp: now - 2 * 3600,
    likenum: 18,
    reply: 12,
    is_follow: 0,
    label_info: mockLeafTags[6],
  },
  {
    pid: 39403195,
    text: "认真夸夸今天图书馆帮我捡回校园卡的同学。还没来得及问名字，只记得你背着一个绿色帆布包，谢谢你。",
    type: "text",
    timestamp: now - 3 * 3600,
    likenum: 207,
    reply: 16,
    is_follow: 0,
    tag: "今日好事",
  },
  {
    pid: 39402864,
    text: "毕业之后才发现，燕园最让人怀念的不是某一个地标，而是从教室出来时恰好遇见朋友、一起吃顿饭的那些普通晚上。",
    type: "text",
    timestamp: now - 5 * 3600,
    likenum: 311,
    reply: 48,
    is_follow: 0,
  },
  {
    pid: 39402510,
    text: "出一套保存很新的心理学导论教材和课堂笔记，书上只有少量铅笔标记，校内可以当面看。",
    type: "text",
    kind: 1,
    reward_cost: 8,
    has_reward_good: 0,
    islz: 1,
    timestamp: now - 7 * 3600,
    likenum: 9,
    reply: 5,
    is_follow: 0,
    label_info: mockLeafTags[6],
  },
  {
    pid: 39402146,
    text: "今天的晚霞很漂亮。站在理教门口看了五分钟，突然觉得这周那些没有做完的事情，也不是非要在今晚全部解决。",
    type: "text",
    timestamp: now - 10 * 3600,
    likenum: 156,
    reply: 21,
    is_follow: 0,
  },
];

export const mockComments: Record<number, TreeholeComment[]> = {
  39403318: [
    {
      cid: 81011,
      pid: 39403318,
      name: "Alice",
      text: "我这里刚好多一张同场票，可以一起从东门过去。",
      timestamp: now - 110 * 60,
      likenum: 8,
      reward_good: 1,
      is_lz: 0,
    },
    {
      cid: 81012,
      pid: 39403318,
      name: "Bob",
      text: "蹲一个结束后的返图。",
      timestamp: now - 105 * 60,
      likenum: 2,
      is_lz: 0,
    },
  ],
  39402510: [
    {
      cid: 81021,
      pid: 39402510,
      name: "Alice",
      text: "想收，请问两本教材分别是哪一版？明天下午可以在图书馆门口看书。",
      timestamp: now - 6 * 3600,
      likenum: 3,
      is_lz: 0,
    },
    {
      cid: 81022,
      pid: 39402510,
      name: "Bob",
      text: "如果还在的话排队，也可以今晚校内自取。",
      timestamp: now - 5 * 3600,
      likenum: 1,
      is_lz: 0,
    },
  ],
  39403877: [
    {
      cid: 81001,
      pid: 39403877,
      name: "Alice",
      text: "晚上绕湖一圈的温度已经很舒服了。",
      timestamp: now - 7 * 60,
      likenum: 14,
    },
    {
      cid: 81002,
      pid: 39403877,
      name: "Bob",
      text: "谢谢提醒。刚刚抬头，今晚的月亮也很好看。",
      timestamp: now - 5 * 60,
      likenum: 9,
      quote: { name_tag: "Alice", text: "晚上绕湖一圈的温度已经很舒服了。" },
    },
    {
      cid: 81003,
      pid: 39403877,
      name: "Carol",
      text: "把没有目的的散步加入今天的待办，然后郑重地完成它。",
      timestamp: now - 2 * 60,
      likenum: 27,
    },
  ],
};

export function addMockComment(comment: TreeholeComment) {
  if (!mockComments[comment.pid]) mockComments[comment.pid] = [];
  mockComments[comment.pid].push(comment);
}

export function setMockBestAnswer(cid: number) {
  for (const [pid, comments] of Object.entries(mockComments)) {
    if (!comments.some((comment) => comment.cid === cid)) continue;
    comments.forEach((comment) => {
      comment.reward_good = comment.cid === cid ? 1 : 0;
    });
    const hole = mockHoles.find((item) => item.pid === Number(pid));
    if (hole) hole.has_reward_good = 1;
    return true;
  }
  return false;
}

export function commentsForHole(hole: Hole) {
  return (
    mockComments[hole.pid] ?? [
      {
        cid: hole.pid * 10 + 1,
        pid: hole.pid,
        name: "Alice",
        text: "蹲一个同样感兴趣的洞友。",
        timestamp: hole.timestamp + 180,
        likenum: 4,
      },
      {
        cid: hole.pid * 10 + 2,
        pid: hole.pid,
        name: "Bob",
        text: "有后续的话记得回来更新呀。",
        timestamp: hole.timestamp + 520,
        likenum: 2,
      },
    ]
  );
}
