import { drizzle } from "drizzle-orm/mysql2";
import { medicalResources } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const resources = [
  {
    name: "北京安定医院",
    type: "hospital",
    description: "国家级精神卫生专科医院,提供专业的抑郁症诊疗服务",
    address: "北京市西城区德胜门外安康胡同5号",
    phone: "010-58303000",
    website: "https://www.adyy.cn",
    city: "北京",
    province: "北京市",
    rating: 5
  },
  {
    name: "上海市精神卫生中心",
    type: "hospital",
    description: "三级甲等精神卫生专科医院,综合实力雄厚",
    address: "上海市徐汇区宛平南路600号",
    phone: "021-34289888",
    website: "https://www.smhc.org.cn",
    city: "上海",
    province: "上海市",
    rating: 5
  },
  {
    name: "广州市脑科医院",
    type: "hospital",
    description: "华南地区知名精神卫生专科医院",
    address: "广州市荔湾区明心路36号",
    phone: "020-81891425",
    website: "https://www.gzbrain.com",
    city: "广州",
    province: "广东省",
    rating: 5
  },
  {
    name: "简单心理",
    type: "counselor",
    description: "专业在线心理咨询平台,提供一对一心理咨询服务",
    phone: "400-8508-120",
    website: "https://www.jiandanxinli.com",
    city: "全国",
    province: "全国",
    rating: 4
  },
  {
    name: "壹心理",
    type: "counselor",
    description: "心理健康服务平台,提供心理咨询和测评服务",
    phone: "400-638-2133",
    website: "https://www.xinli001.com",
    city: "全国",
    province: "全国",
    rating: 4
  },
  {
    name: "全国心理援助热线",
    type: "hotline",
    description: "24小时免费心理援助热线",
    phone: "010-82951332",
    city: "全国",
    province: "全国",
    rating: 5
  },
  {
    name: "北京心理危机研究与干预中心",
    type: "hotline",
    description: "24小时心理危机干预热线",
    phone: "010-82951332",
    city: "北京",
    province: "北京市",
    rating: 5
  },
  {
    name: "上海市心理援助热线",
    type: "hotline",
    description: "24小时心理援助服务",
    phone: "021-12320-5",
    city: "上海",
    province: "上海市",
    rating: 5
  }
];

async function seed() {
  console.log("开始初始化医疗资源数据...");
  
  for (const resource of resources) {
    await db.insert(medicalResources).values(resource);
    console.log(`已添加: ${resource.name}`);
  }
  
  console.log("医疗资源数据初始化完成!");
  process.exit(0);
}

seed().catch(console.error);
