"""
插入高校 AI/Web3 活动 Mock 数据

用法: python manage.py seed_events

参考 seed_topics.py 模式，提供 8 条覆盖不同分类和类型的种子数据，
用于开发测试和演示。
"""
import json
from django.core.management.base import BaseCommand
from home.models import UniversityEvent


class Command(BaseCommand):
    help = '插入高校 AI/Web3 活动 Mock 数据'

    def handle(self, *args, **options):
        mock_data = [
            {
                'title': '清华大学 AI 前沿论坛 2026',
                'university': '清华大学',
                'event_date': '2026-07-20',
                'event_end_date': '2026-07-21',
                'location': '清华大学 FIT 楼多功能厅',
                'description': '汇聚国内外 AI 顶尖学者，探讨大模型、具身智能等前沿课题，含 keynote 演讲和圆桌讨论。',
                'source_url': 'https://www.tsinghua.edu.cn/info/ai_forum_2026',
                'source_name': '清华大学官网',
                'contact_email': 'ai-forum@tsinghua.edu.cn',
                'contact_phone': '010-62781234',
                'category': 'AI',
                'event_type': '论坛',
                'registration_url': 'https://www.tsinghua.edu.cn/ai_forum_2026/register',
                'score': 9,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '浙江大学 Web3 黑客松 · ZJU Hack 2026',
                'university': '浙江大学',
                'event_date': '2026-08-15',
                'event_end_date': '2026-08-17',
                'location': '浙江大学紫金港校区月牙楼',
                'description': '48 小时 Web3 创新黑客松，赛道含 DeFi、NFT、DAO、链上 AI，奖金池 50 万 RMB。',
                'source_url': 'https://www.zju.edu.cn/hackathon_web3_2026',
                'source_name': '浙江大学计算机学院',
                'contact_email': 'hack@zju.edu.cn',
                'contact_phone': '0571-87981234',
                'category': 'Web3',
                'event_type': '黑客松',
                'registration_url': 'https://zju-hack-2026.devpost.com',
                'score': 10,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '上海交通大学 AI+Web3 交叉创新研讨会',
                'university': '上海交通大学',
                'event_date': '2026-07-25',
                'event_end_date': None,
                'location': '上海交通大学闵行校区电院报告厅',
                'description': '探讨 AI 与 Web3 交叉领域的前沿方向，包括去中心化 AI、ZKML、联邦学习与区块链等。',
                'source_url': 'https://www.sjtu.edu.cn/ai_web3_workshop_2026',
                'source_name': '上海交通大学电院',
                'contact_email': 'aiweb3@sjtu.edu.cn',
                'contact_phone': '',
                'category': 'AI+Web3',
                'event_type': '工作坊',
                'registration_url': '',
                'score': 8,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '复旦大学区块链技术与应用讲座',
                'university': '复旦大学',
                'event_date': '2026-07-18',
                'event_end_date': None,
                'location': '复旦大学邯郸校区逸夫楼',
                'description': '邀请以太坊基金会研究员分享区块链底层技术最新进展及生态应用案例。',
                'source_url': 'https://www.fudan.edu.cn/blockchain_lecture_2026',
                'source_name': '复旦大学计算机学院',
                'contact_email': 'cs-lecture@fudan.edu.cn',
                'contact_phone': '021-65641234',
                'category': 'Web3',
                'event_type': '讲座',
                'registration_url': 'https://www.fudan.edu.cn/blockchain_lecture_2026/rsvp',
                'score': 7,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '北京大学 AI 安全与对齐论坛',
                'university': '北京大学',
                'event_date': '2026-08-05',
                'event_end_date': '2026-08-06',
                'location': '北京大学英杰交流中心',
                'description': '聚焦 AI 安全、价值对齐、可解释性等关键议题，邀请 Anthropic、OpenAI 等企业专家参与。',
                'source_url': 'https://www.pku.edu.cn/ai_safety_forum_2026',
                'source_name': '北京大学 AI 研究院',
                'contact_email': 'ai-safety@pku.edu.cn',
                'contact_phone': '010-62751234',
                'category': 'AI',
                'event_type': '论坛',
                'registration_url': 'https://www.pku.edu.cn/ai_safety_forum_2026/register',
                'score': 9,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '中国科学技术大学量子计算与 AI 前沿讲座',
                'university': '中国科学技术大学',
                'event_date': '2026-07-28',
                'event_end_date': None,
                'location': '中国科大西区活动中心',
                'description': '潘建伟团队分享量子计算最新突破及其与人工智能的交叉应用前景。',
                'source_url': 'https://www.ustc.edu.cn/quantum_ai_lecture_2026',
                'source_name': '中国科大官网',
                'contact_email': 'quantum-ai@ustc.edu.cn',
                'contact_phone': '',
                'category': 'AI',
                'event_type': '讲座',
                'registration_url': '',
                'score': 8,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '电子科技大学 Web3 创新应用大赛',
                'university': '电子科技大学',
                'event_date': '2026-09-01',
                'event_end_date': '2026-09-30',
                'location': '电子科技大学清水河校区 + 线上',
                'description': '面向全国高校学生的 Web3 创新应用大赛，涵盖 Solidity 开发、DApp 设计、代币经济模型等。',
                'source_url': 'https://www.uestc.edu.cn/web3_contest_2026',
                'source_name': '电子科技大学信软学院',
                'contact_email': 'web3-contest@uestc.edu.cn',
                'contact_phone': '028-61831234',
                'category': 'Web3',
                'event_type': '其他',
                'registration_url': 'https://www.uestc.edu.cn/web3_contest_2026/signup',
                'score': 8,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
            {
                'title': '武汉大学 AI 驱动 DeFi 创新工作坊',
                'university': '武汉大学',
                'event_date': '2026-08-10',
                'event_end_date': None,
                'location': '武汉大学计算机学院大楼',
                'description': '实操工作坊：使用 AI Agent 构建 DeFi 策略，涵盖 MEV 保护、自动化做市、智能套利等。',
                'source_url': 'https://www.whu.edu.cn/ai_defi_workshop_2026',
                'source_name': '武汉大学区块链协会',
                'contact_email': 'blockchain@whu.edu.cn',
                'contact_phone': '',
                'category': 'AI+Web3',
                'event_type': '工作坊',
                'registration_url': 'https://luma.com/whu-ai-defi-workshop',
                'score': 7,
                'raw_data': json.dumps({'source': 'mock', 'note': '种子数据'}),
            },
        ]

        new_count = 0
        updated_count = 0

        for item in mock_data:
            # 提取 raw_data 并从 defaults 中移除（单独处理 JSON 序列化）
            raw_data = item.pop('raw_data', '')

            obj, created = UniversityEvent.objects.update_or_create(
                source_url=item['source_url'],
                defaults={
                    **item,
                    'raw_data': raw_data,
                },
            )

            if created:
                new_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  + [{item["category"]}] {item["title"]} — {item["university"]}'
                    )
                )
            else:
                updated_count += 1
                self.stdout.write(f'  ~ 更新: {item["title"]}')

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'完成！新增 {new_count} 条，更新 {updated_count} 条活动'
            )
        )
